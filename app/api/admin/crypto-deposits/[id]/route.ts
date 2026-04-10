import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    const result = await requireApiUser("SPADMIN");
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    const params = await props.params;

    try {
        const body = await req.json();
        const { action } = body;

        if (action !== "APPROVE" && action !== "REJECT") {
            return NextResponse.json({ error: "Hành động không hợp lệ" }, { status: 400 });
        }

        const deposit = await prisma.cryptoDeposit.findUnique({
            where: { id: params.id }
        });

        if (!deposit) return NextResponse.json({ error: "Không tìm thấy lệnh USDT!" }, { status: 404 });

        if (deposit.status !== "PENDING") {
             return NextResponse.json({ error: "Lệnh nạp này đã được xử lý hoặc hết hạn." }, { status: 400 });
        }

        if (action === "REJECT") {
            await prisma.$transaction(async (tx) => {
                const currentDeposit = await tx.cryptoDeposit.findUnique({ where: { id: deposit.id } });
                if (!currentDeposit || currentDeposit.status !== "PENDING") {
                    throw new Error("Lệnh nạp này đã được xử lý hoặc hết hạn.");
                }
                await tx.cryptoDeposit.update({
                    where: { id: deposit.id },
                    data: { status: "EXPIRED" }
                });
            });

            const { sendTelegramNotification } = await import("@/lib/telegram");
            await sendTelegramNotification(deposit.userId, `❌ *Nạp Crypto Bị Hủy*\nLệnh nạp ${deposit.amount} USDT của bạn đã bị từ chối/hủy bởi admin.`, "USER_DEPOSIT");
            return NextResponse.json({ success: true, message: "Đã từ chối lệnh nạp USDT." });
        }

        // Lấy USDT RATE
        const rateConfig = await prisma.systemConfig.findUnique({ where: { key: "USDT_RATE" } });
        const USDT_RATE = rateConfig?.value ? parseInt(rateConfig.value, 10) : 25500;

        // APPROVE: Cộng tiền VND cho User
        const convertedVND = deposit.amount * USDT_RATE;

        await prisma.$transaction(async (tx) => {
             const currentDeposit = await tx.cryptoDeposit.findUnique({ where: { id: deposit.id } });
             if (!currentDeposit || currentDeposit.status !== "PENDING") {
                  throw new Error("Lệnh nạp này đã được xử lý hoặc hết hạn.");
             }

             // 1. Cộng tiền user
             await tx.user.update({
                 where: { id: deposit.userId },
                 data: { balance: { increment: convertedVND } }
             });

             // 2. Chốt trạng thái
             await tx.cryptoDeposit.update({
                 where: { id: deposit.id },
                 data: { status: "COMPLETED", txId: "SPADMIN_MANUAL_APPROVAL" }
             });

             // 3. Ghi vết giao dịch
             await tx.transaction.create({
                 data: {
                     userId: deposit.userId,
                     amount: convertedVND,
                     type: "DEPOSIT",
                     note: `Nạp ${deposit.amount} USDT thành công (Quy đổi: ${USDT_RATE}đ/USDT). Duyệt bởi SPAdmin ${result.user.username}`
                 }
             });
        });

        const { sendTelegramNotification } = await import("@/lib/telegram");
        await sendTelegramNotification(deposit.userId, `🎉 *Nạp Crypto Thành Công*\nLệnh nạp ${deposit.amount} USDT đã được duyệt. Bạn nhận được ${convertedVND.toLocaleString()} VNĐ vào tài khoản!`, "USER_DEPOSIT");

        return NextResponse.json({ success: true, message: `Đã duyệt thành công, cộng ${convertedVND.toLocaleString()} VNĐ cho User.` });

    } catch (e: any) {
        if (e.message?.includes("đã được xử lý")) {
             return NextResponse.json({ error: e.message }, { status: 400 });
        }
        return NextResponse.json({ error: e.message || "Lỗi xử lý duyệt USDT" }, { status: 500 });
    }
}
