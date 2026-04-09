import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";

export async function POST(req: Request, props: { params: Promise<{ orderId: string }> }) {
    const result = await requireApiUser();
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    const params = await props.params;

    const deposit = await prisma.bankDeposit.findUnique({
        where: { id: params.orderId, userId: result.user.id }
    });

    if (!deposit) return NextResponse.json({ error: "Không tìm thấy lệnh!" }, { status: 404 });
    if (deposit.status !== "TRANSFERRED") return NextResponse.json({ error: "Chỉ được khiếu nại sau khi đã báo Đã Chuyển khoản." }, { status: 400 });

    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (deposit.updatedAt > fifteenMinsAgo) {
        return NextResponse.json({ error: "Vui lòng chờ 15 phút sau khi báo chuyển khoản để tạo khiếu nại." }, { status: 400 });
    }

    try {
        const body = await req.json();
        const base64Image = body.image;
        if (!base64Image || typeof base64Image !== 'string') {
            return NextResponse.json({ error: "Vui lòng upload ảnh bằng chứng hợp lệ." }, { status: 400 });
        }

        // 1. Kiểm tra kích thước chuỗi (tối đa ~3MB ~ 4.000.000 ký tự)
        if (base64Image.length > 4000000) {
            return NextResponse.json({ error: "Dung lượng ảnh quá lớn. Vui lòng giảm kích thước ảnh." }, { status: 400 });
        }

        // 2. Chặn Injection / XSS: Regex kiểm tra định dạng base64 chuẩn của ảnh phổ biến
        const validImageRegex = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;
        if (!validImageRegex.test(base64Image)) {
            return NextResponse.json({ error: "Định dạng ảnh không được hỗ trợ hoặc file có chứa mã độc." }, { status: 400 });
        }

        const updated = await prisma.bankDeposit.update({
            where: { id: deposit.id },
            data: { 
                status: "COMPLAINED",
                complaintImage: body.image
            }
        });

        return NextResponse.json({ success: true, status: updated.status });
    } catch (e: any) {
        return NextResponse.json({ error: "Lỗi xử lý dữ liệu ảnh." }, { status: 500 });
    }
}
