import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";

export async function GET(req: Request, props: { params: Promise<{ orderId: string }> }) {
    const result = await requireApiUser();
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    const params = await props.params;

    const deposit = await prisma.bankDeposit.findUnique({
        where: { id: params.orderId, userId: result.user.id },
        include: { admin: { select: { bankConfig: true, role: true } } }
    });

    if (!deposit) return NextResponse.json({ error: "Không tìm thấy lệnh nạp" }, { status: 404 });

    if (deposit.status === "PENDING" && deposit.expiresAt < new Date()) {
        const isSpAdminRole = (role: string) => role === "SPADMIN";
        if (deposit.admin && deposit.admin.role) {
            const isTargetAdminSpAdmin = isSpAdminRole(deposit.admin.role);

            await prisma.$transaction(async (tx) => {
                const currentDeposit = await tx.bankDeposit.findUnique({ where: { id: deposit.id }});
                // Ensure it wasn't already processed by another concurrent request
                if (currentDeposit && currentDeposit.status === "PENDING") {
                    if (!isTargetAdminSpAdmin) {
                        await tx.user.update({
                            where: { id: deposit.adminId },
                            data: { balance: { increment: deposit.amount } }
                        });
                        await tx.transaction.create({
                            data: {
                                userId: deposit.adminId,
                                amount: deposit.amount,
                                type: "ADMIN_ADJUSTMENT",
                                note: `[Hoàn Escrow] Lệnh chờ nạp Bank từ User ${result.user.id} quá hạn`
                            }
                        });
                    }
                    
                    await tx.bankDeposit.update({
                        where: { id: deposit.id },
                        data: { status: "EXPIRED" }
                    });
                }
            });
        }
        deposit.status = "EXPIRED";
    }

    return NextResponse.json({
        id: deposit.id,
        status: deposit.status,
        amount: deposit.amount,
        adminId: deposit.adminId,
        updatedAt: deposit.updatedAt,
        expiresAt: deposit.expiresAt,
        adminInfo: deposit.admin?.bankConfig ? {
            bankName: deposit.admin.bankConfig.bankName,
            accountNumber: deposit.admin.bankConfig.accountNumber,
            accountName: deposit.admin.bankConfig.accountName,
            branch: deposit.admin.bankConfig.branch,
            contactInfo: deposit.admin.bankConfig.contactInfo
        } : null
    });
}
