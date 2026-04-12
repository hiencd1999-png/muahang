import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { isSpAdminRole } from "@/lib/roles";

export async function POST(req: Request, { params }: { params: { id: string } }) {
    const result = await requireApiUser();
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    if (!isSpAdminRole(result.user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { isActive } = await req.json();

    await prisma.adminBankConfig.update({
        where: { id: params.id },
        data: { isActive: !!isActive }
    });

    return NextResponse.json({ success: true });
}
