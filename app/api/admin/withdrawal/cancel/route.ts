import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import z from "zod";

const schema = z.object({
  id: z.number(),
});

export async function POST(req: NextRequest) {
  try {
    const result = await requireApiUser("ADMIN");
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    const body = await req.json();
    const data = schema.parse(body);

    const user = result.user;

    const withdrawal = await prisma.withdrawal.findUnique({ where: { id: data.id } });
    
    if (!withdrawal) {
        return NextResponse.json({ error: "Không tìm thấy lệnh rút" }, { status: 404 });
    }
    
    if (withdrawal.userId !== user.id) {
        return NextResponse.json({ error: "Bạn không có quyền thao tác lệnh này" }, { status: 403 });
    }

    if (withdrawal.status !== "PENDING") {
        return NextResponse.json({ error: "Lệnh đã được xử lý, không thể tự hủy" }, { status: 400 });
    }

    const updateResult = await prisma.withdrawal.updateMany({
        where: { id: data.id, status: "PENDING" },
        data: { 
            status: "CANCELED", 
            rejectReason: "Quản trị viên tự hủy" 
        }
    });

    if (updateResult.count === 0) {
        return NextResponse.json({ error: "Lệnh rút tiền đã được hệ thống xử lý trước khi bạn hủy." }, { status: 409 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
