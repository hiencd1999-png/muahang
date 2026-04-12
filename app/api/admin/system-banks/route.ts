import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { isSpAdminRole } from "@/lib/roles";

export async function GET(req: Request) {
    const result = await requireApiUser();
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    if (!isSpAdminRole(result.user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const configs = await prisma.adminBankConfig.findMany({
        include: { admin: { select: { id: true, username: true, fullName: true } } },
        orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ configs });
}
