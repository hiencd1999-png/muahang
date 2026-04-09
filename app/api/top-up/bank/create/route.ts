import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { z } from "zod";
import { getClientIp, verifyRateLimit, verifyIdempotency } from "@/lib/security";

const createSchema = z.object({
    adminId: z.number(),
    amount: z.number().min(1000)
});

export async function POST(req: Request) {
    const ip = getClientIp(req);
    // Anti-DDoS: Rate Limit Max 3 reqs per minute for bank deposit creation
    if (!verifyRateLimit(ip + ':bank_create', 3, 60000)) {
         return NextResponse.json({ error: "Thao tác quá nhanh. Vui lòng kết thúc các lệnh trước đó hoặc chờ 1 phút." }, { status: 429 });
    }

    const idempotencyKey = req.headers.get("x-idempotency-key");
    if (idempotencyKey && !verifyIdempotency(idempotencyKey)) {
         return NextResponse.json({ error: "Lệnh đang được xử lý, tránh nhấn đúp 2 lần!" }, { status: 409 });
    }

    const result = await requireApiUser();
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    try {
        const body = await req.json();
        const { adminId, amount } = createSchema.parse(body);

        // Check if admin config exists and is active
        const config = await prisma.adminBankConfig.findUnique({
            where: { adminId },
            include: { admin: true }
        });

        if (!config || !config.isActive) {
            return NextResponse.json({ error: "Kênh nạp này đang bảo trì hoặc không tồn tại." }, { status: 400 });
        }
        
        const isSpAdminRole = (role: string) => role === "SPADMIN";
        const isAdminSpAdmin = isSpAdminRole(config.admin.role);
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 mins

        const deposit = await prisma.$transaction(async (tx) => {
             if (!isAdminSpAdmin) {
                  const currentAdmin = await tx.user.findUnique({ where: { id: config.adminId }});
                  if (!currentAdmin || currentAdmin.balance < amount) {
                       throw new Error("Thanh khoản của Admin này hiện đang tạm hết. Vui lòng giảm số VNĐ hoặc chọn Admin khác.");
                  }
                  
                  // ESCROW LOCK: Deduct balance immediately
                  await tx.user.update({
                      where: { id: config.adminId },
                      data: { balance: { decrement: amount } }
                  });
                  
                  await tx.transaction.create({
                      data: {
                          userId: config.adminId,
                          amount: -amount,
                          type: "ADMIN_ADJUSTMENT",
                          note: `[Tạm giữ] Lệnh nạp Bank đang đóng băng từ User ${result.user.id}`
                      }
                  });
             }

             return await tx.bankDeposit.create({
                 data: {
                     userId: result.user.id,
                     adminId,
                     amount,
                     expiresAt,
                     status: "PENDING"
                 }
             });
        });

        return NextResponse.json({
            id: deposit.id,
            status: deposit.status,
            amount: deposit.amount,
            adminId: deposit.adminId,
            updatedAt: deposit.updatedAt,
            expiresAt: deposit.expiresAt,
            adminInfo: {
                bankName: config.bankName,
                accountNumber: config.accountNumber,
                accountName: config.accountName,
                branch: config.branch,
                contactInfo: config.contactInfo
            }
        });

    } catch (e: any) {
        if (e instanceof z.ZodError) {
             return NextResponse.json({ error: "Số tiền nạp không hợp lệ (Tối thiểu 10,000 VNĐ)." }, { status: 400 });
        }
        return NextResponse.json({ error: e.message || "Có lỗi xảy ra hoặc dữ liệu không hợp lệ." }, { status: 400 });
    }
}
