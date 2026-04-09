import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";

export async function GET(req: Request) {
    const result = await requireApiUser();
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    const deposits = await prisma.cryptoDeposit.findMany({
        where: { userId: result.user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
    });

    return NextResponse.json(deposits);
}
