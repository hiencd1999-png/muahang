import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { isSpAdminRole } from "@/lib/roles";

export async function GET(req: Request) {
    const result = await requireApiUser();
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    if (result.user.role === "USER") {
        return NextResponse.json({ error: "Không đủ quyền" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "TRANSFERRED";

    let whereClause: any = { status };

    // spadmin can see all, admin can only see theirs
    if (!isSpAdminRole(result.user.role)) {
        whereClause.adminId = result.user.id;
    }

    const deposits = await prisma.bankDeposit.findMany({
        where: whereClause,
        orderBy: { updatedAt: "desc" },
        include: {
            user: { select: { username: true, fullName: true, phone: true } },
            admin: { select: { username: true, fullName: true } }
        }
    });

    return NextResponse.json({ deposits, isSpAdmin: isSpAdminRole(result.user.role), currentUserId: result.user.id });
}
