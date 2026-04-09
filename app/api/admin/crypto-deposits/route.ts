import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const result = await requireApiUser("SPADMIN");
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    try {
        const deposits = await prisma.cryptoDeposit.findMany({
            orderBy: { createdAt: "desc" },
            include: { user: { select: { username: true } } },
            take: 100 // Lấy 100 giao dịch gần nhất
        });
        return NextResponse.json(deposits);
    } catch (e: any) {
        return NextResponse.json({ error: "Lỗi tải dữ liệu" }, { status: 500 });
    }
}
