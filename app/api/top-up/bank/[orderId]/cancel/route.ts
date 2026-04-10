import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";

export async function POST(req: Request, props: { params: Promise<{ orderId: string }> }) {
    const result = await requireApiUser();
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    const params = await props.params;

    const deposit = await prisma.bankDeposit.findUnique({
        where: { id: params.orderId, userId: result.user.id },
        include: { admin: true }
    });

    if (!deposit) return NextResponse.json({ error: "Không tìm thấy lệnh!" }, { status: 404 });
    if (deposit.status !== "PENDING" && deposit.status !== "TRANSFERRED") {
        return NextResponse.json({ error: "Lệnh nạp này đã được xử lý hoặc không thể huy." }, { status: 400 });
    }

    const isSpAdminRole = (role: string) => role === "SPADMIN";
    const isTargetAdminSpAdmin = isSpAdminRole(deposit.admin.role);

    try {

    const updated = await prisma.$transaction(async (tx) => {
         const currentDeposit = await tx.bankDeposit.findUnique({ where: { id: deposit.id } });
         if (!currentDeposit || (currentDeposit.status !== "PENDING" && currentDeposit.status !== "TRANSFERRED")) {
              throw new Error("Lệnh nạp này đã được xử lý hoặc không thể hủy.");
         }

         if (!isTargetAdminSpAdmin) {
             await tx.user.update({
                 where: { id: deposit.adminId },
                 data: { balance: { increment: deposit.amount } }
             });
             await tx.transaction.create({
                 data: {
                     userId: deposit.adminId,
                     amount: deposit.amount,
                     type: "ADMIN_ADJUSTMENT",
                     note: `[Hoàn Escrow] Lệnh nạp Bank bị Hủy chủ động bởi User ${result.user.id}`
                 }
             });
         }
         
         return await tx.bankDeposit.update({
             where: { id: deposit.id },
             data: { status: "REJECTED" }
         });
    });

    return NextResponse.json({ success: true, status: updated.status });
} catch (error: any) {
    if (error.message?.includes("đã được xử lý") || error.message?.includes("không thể hủy")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Lịch hệ thống khi hủy!" }, { status: 500 });
}
}
