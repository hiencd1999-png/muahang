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
    if (deposit.status !== "PENDING") return NextResponse.json({ error: "Lệnh không ở trạng thái cần chuyển khoản." }, { status: 400 });

    if (deposit.expiresAt < new Date()) {
        return NextResponse.json({ error: "Lệnh đã hết hạn. Hãy đợi hệ thống tự động hủy và hoàn cọc." }, { status: 400 });
    }

    const updateResult = await prisma.bankDeposit.updateMany({
        where: { id: deposit.id, status: "PENDING" },
        data: { status: "TRANSFERRED" }
    });
    
    if (updateResult.count === 0) {
        return NextResponse.json({ error: "Không thể cập nhật. Lệnh đã bị hủy hoặc đã hoàn tất." }, { status: 400 });
    }
    const updatedStatus = "TRANSFERRED";

    const { sendTelegramNotification } = await import("@/lib/telegram");
    
    const adminBankLink = `${process.env.NEXT_PUBLIC_APP_URL || "https://datdon.otistx.com"}/admin/bank-deposits`;

    await sendTelegramNotification(
        deposit.adminId, 
        `🔔 *Khách Đã Chuyển Tiền Cọc*\nUser ${result.user.username} (Mã user: ${result.user.id}) vừa xác nhận chuyển khoản lệnh nạp bank nội bộ.\n- Số tiền: ${(deposit.amount).toLocaleString('vi-VN')} VND\n- *🔗 Mở chi tiết:* [Click để kiểm tra và duyệt](${adminBankLink})`, 
        "ADMIN_DEPOSIT"
    );

    return NextResponse.json({ success: true, status: updatedStatus });
}
