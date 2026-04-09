import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";

export async function POST(req: Request, props: { params: Promise<{ orderId: string }> }) {
    const result = await requireApiUser();
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    const params = await props.params;

    const deposit = await prisma.bankDeposit.findUnique({
        where: { id: params.orderId, userId: result.user.id }
    });

    if (!deposit) return NextResponse.json({ error: "Không tìm thấy lệnh!" }, { status: 404 });
    if (deposit.status !== "PENDING") return NextResponse.json({ error: "Lệnh không ở trạng thái cần chuyển khoản." }, { status: 400 });

    if (deposit.expiresAt < new Date()) {
        await prisma.bankDeposit.update({
            where: { id: deposit.id },
            data: { status: "EXPIRED" }
        });
        return NextResponse.json({ error: "Lệnh đã hết hạn!" }, { status: 400 });
    }

    const updated = await prisma.bankDeposit.update({
        where: { id: deposit.id },
        data: { status: "TRANSFERRED" }
    });

    return NextResponse.json({ success: true, status: updated.status });
}
