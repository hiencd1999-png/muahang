import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";

export async function GET(req: Request, props: { params: Promise<{ orderId: string }> }) {
    const result = await requireApiUser();
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    const params = await props.params;

    const deposit = await prisma.cryptoDeposit.findUnique({
        where: { id: params.orderId, userId: result.user.id }
    });

    if (!deposit) return NextResponse.json({ error: "Không tìm thấy lệnh nạp" }, { status: 404 });

    if (deposit.status === "PENDING" && deposit.expiresAt < new Date()) {
        await prisma.cryptoDeposit.update({
            where: { id: deposit.id },
            data: { status: "EXPIRED" }
        });
        deposit.status = "EXPIRED";
    }

    return NextResponse.json({
        id: deposit.id,
        status: deposit.status,
        expectedAmount: deposit.expectedAmount,
        network: deposit.network,
        address: deposit.address,
        expiresAt: deposit.expiresAt,
        amount: deposit.amount,
        createdAt: deposit.createdAt
    });
}
