import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getLockedAdminCommission } from "@/lib/admin-balance";
import z from "zod";

const schema = z.object({
  id: z.number(),
  action: z.enum(["APPROVE", "REJECT"]),
  rejectReason: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const result = await requireApiUser("SPADMIN");
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    const body = await req.json();
    const data = schema.parse(body);

    const spadminId = result.user.id;

    if (data.action === "APPROVE") {
        // Fix: get rate config before to ensure correct log
        const rateConfig = await prisma.systemConfig.findUnique({ where: { key: "USDT_RATE" } });
        const USDT_RATE = rateConfig?.value ? parseInt(rateConfig.value.replace(/[^0-9]/g, ''), 10) || 25500 : 25500;

        // Sử dụng Interactive Transaction để chống Race Condition
        await prisma.$transaction(async (tx) => {
            const currentWithdrawal = await tx.withdrawal.findUnique({ where: { id: data.id }, include: { user: true } });
            
            if (!currentWithdrawal) {
                 throw new Error("Không tìm thấy lệnh");
            }
            if (currentWithdrawal.status !== "PENDING") {
                 throw new Error("Lệnh đã được xử lý từ trước");
            }

            const lockedCommission = await getLockedAdminCommission(currentWithdrawal.userId, tx);
            const minimumRequiredBalance = currentWithdrawal.amount + lockedCommission;

            // 1. Cập nhật status lệnh rút
            const updateResult = await tx.withdrawal.updateMany({
                where: { id: data.id, status: "PENDING" },
                data: { status: "APPROVED", processedById: spadminId }
            });

            if (updateResult.count === 0) {
                throw new Error("Lệnh rút này đã được xử lý bởi một tiến trình khác.");
            }

            // 2. Trừ tiền An Toàn tuyệt đối
            const userUpdateResult = await tx.user.updateMany({
                where: { id: currentWithdrawal.userId, balance: { gte: minimumRequiredBalance } },
                data: { balance: { decrement: currentWithdrawal.amount } }
            });

            if (userUpdateResult.count === 0) {
                 throw new Error(`Tài khoản admin không đủ số dư khả dụng (do đang bị tạm giữ hoa hồng giải quyết khiếu nại hoặc lỗi giao dịch). Giao dịch thất bại.`);
            }

            // 3. Lưu vết Giao dịch hệ thống 
            const usdtReceived = (currentWithdrawal.amount / USDT_RATE).toFixed(2);
            await tx.transaction.create({
                data: {
                    userId: currentWithdrawal.userId,
                    amount: -currentWithdrawal.amount,
                    type: "WITHDRAWAL",
                    note: `Rút Crypto ~${usdtReceived} USDT (Ví: ${currentWithdrawal.walletAddress.substring(0, 8)}...) - Tỷ giá: ${new Intl.NumberFormat('vi-VN').format(USDT_RATE)}đ - KHỚP: ${result.user.username}`
                }
            });

            // 4. Báo tin
            await tx.notification.create({
                data: {
                    userId: currentWithdrawal.userId,
                    type: "BALANCE_CHANGED",
                    title: "Lệnh Rút Được Cấp Phép",
                    message: `Lệnh rút ${currentWithdrawal.amount.toLocaleString("vi-VN")} VNĐ (~${usdtReceived} USDT) đã được SPAdmin xuất khoản. Tiền trong balance đã được trừ.`,
                }
            });
        });

        // Telegram Notify
        const withdrawal = await prisma.withdrawal.findUnique({ where: { id: data.id } });
        if (withdrawal) {
            const { sendTelegramNotification } = await import("@/lib/telegram");
            const rateConfig = await prisma.systemConfig.findUnique({ where: { key: "USDT_RATE" } });
            const USDT_RATE = rateConfig?.value ? parseInt(rateConfig.value.replace(/[^0-9]/g, ''), 10) || 25500 : 25500;
            const usdtReceived = (withdrawal.amount / USDT_RATE).toFixed(2);
            await sendTelegramNotification(withdrawal.userId, `✅ *Rút USDT Thành Công*\nLệnh rút ${withdrawal.amount.toLocaleString("vi-VN")} VNĐ (~${usdtReceived} USDT) đã được duyệt và xuất khoản!`, "USER_DEPOSIT");
        }

    } else {
        // Reject Logic
        const withdrawal = await prisma.withdrawal.findUnique({ where: { id: data.id } });
        if (!withdrawal || withdrawal.status !== "PENDING") {
            return NextResponse.json({ error: "Lệnh đã được xử lý hoặc không tồn tại." }, { status: 400 });
        }

        await prisma.$transaction(async (tx) => {
            const updateResult = await tx.withdrawal.updateMany({
                where: { id: data.id, status: "PENDING" },
                data: { status: "REJECTED", processedById: spadminId, rejectReason: data.rejectReason || "Từ chối" }
            });

            if (updateResult.count > 0) {
                await tx.notification.create({
                    data: {
                        userId: withdrawal.userId,
                        type: "ADMIN_MESSAGE",
                        title: "Lệnh Rút Tiền Bị Hủy",
                        message: `Lệnh rút ${withdrawal.amount.toLocaleString("vi-VN")} VNĐ đã bị Hủy bỏ. Lý do: ${data.rejectReason || "Không xác định"}.`,
                    }
                });
            }
        });
        
        // Telegram Notify
        const { sendTelegramNotification } = await import("@/lib/telegram");
        await sendTelegramNotification(withdrawal.userId, `❌ *Rút USDT Bị Từ Chối*\nLệnh rút ${withdrawal.amount.toLocaleString()} VNĐ của bạn đã bị hủy.\nLý do: ${data.rejectReason || "Vui lòng liên hệ SPAdmin."}`, "USER_DEPOSIT");
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
