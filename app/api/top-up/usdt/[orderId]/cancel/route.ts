import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";

export async function POST(req: Request, props: { params: Promise<{ orderId: string }> }) {
    const result = await requireApiUser();
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    const params = await props.params;

    const deposit = await prisma.cryptoDeposit.findUnique({
        where: { id: params.orderId, userId: result.user.id }
    });

    if (!deposit) return NextResponse.json({ error: "Không tìm thấy lệnh!" }, { status: 404 });
    if (deposit.status !== "PENDING") {
        return NextResponse.json({ error: "Lệnh nạp này đã được xử lý hoặc không thể huy." }, { status: 400 });
    }

    const updated = await prisma.cryptoDeposit.update({
        where: { id: deposit.id },
        data: { status: "EXPIRED" } // Crypto deposit uses EXPIRED when cancelled manually or timeout
    });

    return NextResponse.json({ success: true, status: updated.status });
}
