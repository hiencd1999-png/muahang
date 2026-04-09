import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
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
        // Sử dụng Interactive Transaction để chống Race Condition (Tránh Admin tạo nhiều lệnh cùng lúc rút lố tiền)
        await prisma.$transaction(async (tx) => {
            const currentWithdrawal = await tx.withdrawal.findUnique({ where: { id: data.id }, include: { user: true } });
            
            if (!currentWithdrawal) {
                 throw new Error("Không tìm thấy lệnh");
            }
            if (currentWithdrawal.status !== "PENDING") {
                 throw new Error("Lệnh đã được xử lý từ trước");
            }

            // Đọc lại balance MỚI NHẤT của Admin bên trong chuỗi giao dịch kín
            const admin = await tx.user.findUnique({ where: { id: currentWithdrawal.userId } });
            if (!admin || admin.balance < currentWithdrawal.amount) {
                 throw new Error("Tài khoản admin không đủ số dư để duyệt lệnh rút này lúc này! Giao dịch thất bại.");
            }

            // 1. Cập nhật status lệnh rút
            await tx.withdrawal.update({
                where: { id: data.id },
                data: { status: "APPROVED", processedById: spadminId }
            });

            // 2. Trừ tiền An Toàn tuyệt đối
            await tx.user.update({
                where: { id: currentWithdrawal.userId },
                data: { balance: { decrement: currentWithdrawal.amount } }
            });

            // 3. Lưu vết Giao dịch hệ thống 
            await tx.transaction.create({
                data: {
                    userId: currentWithdrawal.userId,
                    amount: -currentWithdrawal.amount,
                    type: "WITHDRAWAL",
                    note: `Rút tiền Crypto (Ví: ${currentWithdrawal.walletAddress.substring(0, 8)}...) - KHỚP LỆNH: ${result.user.username}`
                }
            });

            // 4. Báo tin
            await tx.notification.create({
                data: {
                    userId: currentWithdrawal.userId,
                    type: "BALANCE_CHANGED",
                    title: "Lệnh Rút Được Cấp Phép",
                    message: `Lệnh rút ${currentWithdrawal.amount} đã được SPAdmin xuất khoản. Tiền trong balance đã được trừ.`,
                }
            });
        });

    } else {
        // Reject Logic
        const withdrawal = await prisma.withdrawal.findUnique({ where: { id: data.id } });
        if (!withdrawal || withdrawal.status !== "PENDING") {
            return NextResponse.json({ error: "Lệnh đã được xử lý hoặc không tồn tại." }, { status: 400 });
        }

        await prisma.$transaction([
            prisma.withdrawal.update({
                where: { id: data.id },
                data: { status: "REJECTED", processedById: spadminId, rejectReason: data.rejectReason || "Từ chối" }
            }),
            prisma.notification.create({
                data: {
                    userId: withdrawal.userId,
                    type: "ADMIN_MESSAGE",
                    title: "Lệnh Rút Tiền Bị Hủy",
                    message: `Lệnh rút ${withdrawal.amount} đã bị Hủy bỏ. Lý do: ${data.rejectReason || "Không xác định"}.`,
                }
            })
        ]);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
