/**
 * DATDON - ENTERPRISE DEPOSIT SWEEPER WORKER
 * Xuyên suốt xử lý các Single Point of Failures: Rác Escrow tồn đọng
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function sweepExpiredDeposits() {
    console.log(`[Sweeper] Bắt đầu rà quét Lệnh Tồn Đọng ở thời điểm: ${new Date().toISOString()}`);

    try {
        // Tìm toàn bộ lệnh nạp tiền Bank mà chưa ai ngó tới nhưng đã mốc meo quá hạn.
        const stuckOrders = await prisma.bankDeposit.findMany({
            where: {
                status: { in: ["PENDING", "TRANSFERRED"] },
                expiresAt: { lt: new Date() }
            },
            include: { admin: true }
        });

        if (stuckOrders.length === 0) {
            return;
        }
        console.log(`[Sweeper] Phát hiện ${stuckOrders.length} lệnh treo vĩnh viễn (Cron cũ chết hoặc User bỏ hoang). Khởi động Rollback Escrow!`);

        for (const deposit of stuckOrders) {
            const isSpAdminRole = (role: string) => role === "SPADMIN";
            const isTargetAdminSpAdmin = isSpAdminRole(deposit.admin.role);

            // Bọc cẩn thận qua ACID $transaction để dù lỗi RAM cũng an toàn cực độ
            await prisma.$transaction(async (tx) => {
                const updateResult = await tx.bankDeposit.updateMany({
                     where: { id: deposit.id, status: { in: ["PENDING", "TRANSFERRED"] } },
                     data: { status: "EXPIRED" }
                });

                if (updateResult.count > 0 && !isTargetAdminSpAdmin) {
                    await tx.user.update({
                        where: { id: deposit.adminId },
                        data: { balance: { increment: deposit.amount } }
                    });
                    await tx.transaction.create({
                         data: {
                             userId: deposit.adminId,
                             amount: deposit.amount,
                             type: "ADMIN_ADJUSTMENT",
                             note: `[Hệ Thống] Rollback tự động: Hoàn trả Escrow cho lệnh Bank quá hạn từ User ${deposit.userId}`
                         }
                    });
                }
            });
            console.log(`[Sweeper] ♻️ Rollback thành công lệnh cọc mã ${deposit.id}`);
        }
    } catch (error) {
        console.error(`[Sweeper-Critical] Lỗi khi dọn rác Escrow:`, error);
    } finally {
        await prisma.$disconnect();
    }
}

// Chạy script
if (require.main === module) {
    sweepExpiredDeposits();
}
