import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { isSpAdminRole } from "@/lib/roles";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    const result = await requireApiUser();
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    if (result.user.role === "USER") {
        return NextResponse.json({ error: "Không đủ quyền" }, { status: 403 });
    }

    const params = await props.params;

    try {
        const body = await req.json();
        const { action } = body; // "APPROVE" | "REJECT"

        if (action !== "APPROVE" && action !== "REJECT") {
            return NextResponse.json({ error: "Hành động không hợp lệ" }, { status: 400 });
        }

        const deposit = await prisma.bankDeposit.findUnique({
            where: { id: params.id },
            include: { admin: true }
        });

        if (!deposit) return NextResponse.json({ error: "Không tìm thấy lệnh!" }, { status: 404 });

        // Quyền duyệt:
        // - Trạng thái KHIẾU NẠI (COMPLAINED): Chỉ SPAdmin được duyệt/từ chối. Admin thường chỉ xem.
        // - Trạng thái BÌNH THƯỜNG (TRANSFERRED): Chỉ Admin sở hữu (Owner) được duyệt/từ chối. SPAdmin không được can thiệp vào gd của người khác (trừ khi mình là owner).
        const isSpAdmin = isSpAdminRole(result.user.role);
        const isOwner = deposit.adminId === result.user.id;

        if (deposit.status === "COMPLAINED") {
             if (!isSpAdmin) {
                 return NextResponse.json({ error: "Chỉ SPAdmin mới có quyền duyệt hoặc từ chối đơn khiếu nại." }, { status: 403 });
             }
        } else if (deposit.status === "TRANSFERRED") {
             if (!isOwner) {
                 return NextResponse.json({ error: "Bạn không có quyền duyệt lệnh chuyển khoản của Admin khác." }, { status: 403 });
             }
        }

        if (deposit.status === "COMPLETED" || deposit.status === "REJECTED" || deposit.status === "EXPIRED") {
             return NextResponse.json({ error: "Lệnh này đã được xử lý hoặc hết hạn." }, { status: 400 });
        }

        const isTargetAdminSpAdmin = isSpAdminRole(deposit.admin.role);

        if (action === "REJECT") {
            await prisma.$transaction(async (tx) => {
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
                             note: `[Hoàn Escrow] Hủy và hoàn trả lệnh nạp chờ từ User ${deposit.userId}`
                         }
                     });
                 }
                 await tx.bankDeposit.update({
                     where: { id: deposit.id },
                     data: { status: "REJECTED", complaintImage: null }
                 });
            });
            const { sendTelegramNotification } = await import("@/lib/telegram");
            await sendTelegramNotification(deposit.userId, `❌ *Lệnh Nạp Bị Từ Chối*\nLệnh nạp ${deposit.amount.toLocaleString()} VND đã bị từ chối/hủy. Vui lòng liên hệ hỗ trợ nếu cần.`, "USER_DEPOSIT");
            return NextResponse.json({ success: true, message: "Đã từ chối lệnh nạp và hoàn Escrow." });
        }

        // APPROVE: Trừ Escrow, cộng tiền user
        await prisma.$transaction(async (tx) => {
             // Cộng tiền user
             await tx.user.update({
                 where: { id: deposit.userId },
                 data: { balance: { increment: deposit.amount } }
             });

             // Mark order as COMPLETED
             await tx.bankDeposit.update({
                 where: { id: deposit.id },
                 data: { status: "COMPLETED", complaintImage: null }
             });

             // Lưu lịch sử giao dịch: Cộng User
             await tx.transaction.create({
                 data: {
                     userId: deposit.userId,
                     amount: deposit.amount,
                     type: "DEPOSIT",
                     note: `Nạp tiền Bank Nội Bộ thành công (Admin ID ${deposit.adminId} duyệt)`
                 }
             });
        });

        // Telegram Notify Success
        const { sendTelegramNotification } = await import("@/lib/telegram");
        await sendTelegramNotification(deposit.userId, `🎉 *Nạp Nội Bộ Thành Công*\nTuyệt vời! Lệnh nạp ${deposit.amount.toLocaleString()} VND của bạn đã được duyệt. Số dư đã cập nhật.`, "USER_DEPOSIT");

        return NextResponse.json({ success: true, message: "Đã duyệt và cộng tiền thành công!" });

    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Đã có lỗi xảy ra." }, { status: 400 });
    }
}
