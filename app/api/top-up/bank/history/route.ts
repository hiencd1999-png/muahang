import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";

export async function GET(req: Request) {
    const result = await requireApiUser();
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    const deposits = await prisma.bankDeposit.findMany({
        where: { userId: result.user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
            admin: { select: { bankConfig: true } }
        }
    });

    const formatted = deposits.map(d => ({
        id: d.id,
        status: d.status,
        amount: d.amount,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        expiresAt: d.expiresAt,
        adminInfo: d.admin?.bankConfig ? {
            bankName: d.admin.bankConfig.bankName,
            accountNumber: d.admin.bankConfig.accountNumber,
            accountName: d.admin.bankConfig.accountName,
            branch: d.admin.bankConfig.branch,
            contactInfo: d.admin.bankConfig.contactInfo
        } : null
    }));

    return NextResponse.json(formatted);
}
