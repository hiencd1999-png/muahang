import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const configs = await prisma.adminBankConfig.findMany({
        where: { isActive: true },
        include: { admin: { select: { fullName: true, username: true } } }
    });

    const results = configs.map(c => ({
        adminId: c.adminId,
        adminName: c.admin.fullName || c.admin.username,
        bankName: c.bankName,
        accountNumber: c.accountNumber,
        accountName: c.accountName,
        branch: c.branch,
        contactInfo: c.contactInfo
    }));

    return NextResponse.json({ configs: results });
}
