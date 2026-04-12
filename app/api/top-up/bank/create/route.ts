import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { z } from "zod";
import { getClientIp, verifyRateLimit, verifyIdempotency } from "@/lib/security";
import { getLockedAdminCommission } from "@/lib/admin-balance";

function generateVietnameseName() {
    const HO = ["NGUYEN", "TRAN", "LE", "PHAM", "VO", "VU", "PHAN", "DANG", "BUI", "DO", "HO", "NGO", "DUONG", "LY", "MAI", "TRINH", "CAO", "LAM", "TO", "DIEP", "TON", "THACH", "KIEU", "DINH"];
    const DEM = ["VAN", "THI", "NGOC", "HOANG", "MINH", "QUANG", "THAI", "XUAN", "THANH", "HAI", "TUAN", "ANH", "GIA", "KIM", "QUOC", "DINH", "HONG", "TIEU", "TRUNG", "TIEN", "PHUC", "CONG", "BA", "DAC", "DAI", "PHI", "KHAC", "HUY", "QUY", "KIEN", "NGUYEN", "CAO", "LAM", "DAN", "DONG", "MANH"];
    const TEN = ["BANG", "DAT", "HUNG", "HUY", "CUONG", "KHOI", "KHOA", "MANH", "LINH", "TRANG", "MAI", "DUC", "SON", "THANG", "LONG", "DUONG", "TUNG", "BACH", "PHONG", "AN", "HOA", "THUY", "THIEN", "TRI", "TAI", "PHAT", "LOC", "KHOE", "CHAU", "NGAN", "KHANG", "TIN", "BAO", "HANG", "HIEN", "THAO", "OANH", "YEN", "QUYEN", "GIANG", "HAO", "THANH", "LUAN", "TU", "TRONG", "BINH", "BICH", "CHANH", "CUC", "DIEN", "DON", "KY", "LIEN", "MY", "NAM", "NGA", "NHAN", "NHI", "NHU", "NHAT", "PHU", "PHUONG", "QUAN", "SANG", "SINH", "TON", "TRAM", "TOAN", "TUYET", "UYEN", "VI", "XUYEN", "CANG", "CHAN", "DAM"];
    const ho = HO[Math.floor(Math.random() * HO.length)];
    const dem = DEM[Math.floor(Math.random() * DEM.length)];
    const ten = TEN[Math.floor(Math.random() * TEN.length)];
    return `${ho} ${dem} ${ten}`;
}

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

         // Generate Unique Transfer Code
         let transferCode = "";
         let isUnique = false;
         let attempts = 0;
         while (!isUnique && attempts < 15) {
             transferCode = generateVietnameseName();
             if (attempts > 10) {
                 transferCode += " " + Math.floor(1 + Math.random() * 99);
             }
             const existing = await prisma.bankDeposit.findUnique({ where: { transferCode } });
             if (!existing) isUnique = true;
             attempts++;
         }

         const deposit = await prisma.$transaction(async (tx) => {
              if (!isAdminSpAdmin) {
                  const lockedCommission = await getLockedAdminCommission(config.adminId, tx);
                  const minRequired = amount + lockedCommission;
                  
                  // ESCROW LOCK: Deduct balance immediately
                  const updateResult = await tx.user.updateMany({
                      where: { id: config.adminId, balance: { gte: minRequired } },
                      data: { balance: { decrement: amount } }
                  });
                  
                  if (updateResult.count === 0) {
                       throw new Error("Thanh khoản khả dụng của Admin này hiện đang tạm hết (do một phần quỹ đang tạm giữ). Vui lòng giảm số VNĐ hoặc chọn Admin khác.");
                  }
                  
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
                     transferCode,
                     status: "PENDING"
                 }
             });
        });

        return NextResponse.json({
            id: deposit.id,
            status: deposit.status,
            amount: deposit.amount,
            adminId: deposit.adminId,
            transferCode: deposit.transferCode,
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
