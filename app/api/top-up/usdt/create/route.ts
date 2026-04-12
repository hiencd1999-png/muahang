import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { z } from "zod";

const createSchema = z.object({
    network: z.enum(["BSC", "TRX"]),
    amount: z.number().int().min(5),
});

async function generateUniqueFractionalAmount(amount: number): Promise<number> {
    for (let i = 0; i < 50; i++) {
        // Sinh 2 số ngẫu nhiên từ 1 đến 99 để tạo thành dạng a.00xx
        const fraction = Math.floor(Math.random() * 99) + 1; // 1 -> 99
        // Ví dụ: amount = 5, fraction = 12 => expected = 5.0012
        const expected = amount + (fraction / 10000);
        
        const exists = await prisma.cryptoDeposit.findFirst({
            where: { expectedAmount: expected, status: "PENDING" }
        });
        if (!exists) return expected;
    }
    throw new Error("Hệ thống đang bận cho mệnh giá này, vui lòng thử lại sau ít phút hoặc nhập số tiền khác.");
}

export async function POST(req: Request) {
    const result = await requireApiUser();
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    try {
        const body = await req.json();
        const parsed = createSchema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: "Tham số không hợp lệ. amount tối thiểu 5 USDT nguyên." }, { status: 400 });

        const { network, amount } = parsed.data;

        const bscConfig = await prisma.systemConfig.findUnique({ where: { key: "CRYPTO_WALLET_BSC" } });
        const trxConfig = await prisma.systemConfig.findUnique({ where: { key: "CRYPTO_WALLET_TRX" } });

        const address = network === "BSC" 
            ? bscConfig?.value?.trim() || ""
            : trxConfig?.value?.trim() || "";

        if (!address) {
            return NextResponse.json({ error: "Hệ thống chưa cấu hình ví nạp cho mạng này." }, { status: 500 });
        }

        const expectedAmount = await generateUniqueFractionalAmount(amount);

        // Hết hạn sau 30 phút (do worker quét history 30 phút)
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

        const deposit = await prisma.cryptoDeposit.create({
            data: {
                userId: result.user.id,
                network,
                address,
                amount,
                expectedAmount,
                status: "PENDING",
                expiresAt,
            }
        });

        const rateConfig = await prisma.systemConfig.findUnique({ where: { key: "USDT_RATE" } });
        const USDT_RATE = rateConfig?.value ? parseInt(rateConfig.value.replace(/[^0-9]/g, ''), 10) || 25500 : 25500;
        const convertedVND = new Intl.NumberFormat('vi-VN').format(expectedAmount * USDT_RATE);

        const { broadcastToAdmins } = await import("@/lib/telegram");
        await broadcastToAdmins(`🔔 *Yêu Cầu Nạp Crypto Mới*\nKhách hàng: ${result.user.username}\nSố tiền: ${expectedAmount} USDT (~${convertedVND} VNĐ)\nMạng: ${network}`, "ADMIN_DEPOSIT");


        return NextResponse.json({
            orderId: deposit.id,
            network: deposit.network,
            address: deposit.address,
            amount: deposit.amount,
            expectedAmount: deposit.expectedAmount,
            expiresAt: deposit.expiresAt,
            status: deposit.status
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Lỗi server" }, { status: 500 });
    }
}
