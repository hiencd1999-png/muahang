import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";

export async function GET(req: Request, props: { params: Promise<{ orderId: string }> }) {
    const result = await requireApiUser();
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    const params = await props.params;

    let deposit = await prisma.bankDeposit.findUnique({
        where: { id: params.orderId, userId: result.user.id },
        include: { admin: { select: { bankConfig: true, role: true } } }
    });

    if (!deposit) return NextResponse.json({ error: "Không tìm thấy lệnh nạp" }, { status: 404 });

    const now = new Date();
    if ((deposit.status === "PENDING" || deposit.status === "TRANSFERRED") && deposit.expiresAt < now) {
        const isSpAdminRole = (role: string) => role === "SPADMIN";
        if (deposit.admin && deposit.admin.role) {
            const isTargetAdminSpAdmin = isSpAdminRole(deposit.admin.role);

            const updateResult = await prisma.$transaction(async (tx) => {
                const count = await tx.bankDeposit.updateMany({
                    where: { id: deposit.id, status: { in: ["PENDING", "TRANSFERRED"] }, expiresAt: { lt: now } },
                    data: { status: "EXPIRED" }
                });

                if (count.count > 0 && !isTargetAdminSpAdmin) {
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

                return count.count;
            });

            if (updateResult > 0) {
                deposit.status = "EXPIRED";
            } else {
                const refreshed = await prisma.bankDeposit.findUnique({
                    where: { id: deposit.id },
                    include: { admin: { select: { bankConfig: true, role: true } } }
                });
                if (refreshed) deposit = refreshed;
            }
        }
    }

    return NextResponse.json({
        id: deposit.id,
        status: deposit.status,
        amount: deposit.amount,
        adminId: deposit.adminId,
        updatedAt: deposit.updatedAt,
        expiresAt: deposit.expiresAt,
        transferCode: deposit.transferCode,
        adminInfo: deposit.admin?.bankConfig ? {
            bankName: deposit.admin.bankConfig.bankName,
            accountNumber: deposit.admin.bankConfig.accountNumber,
            accountName: deposit.admin.bankConfig.accountName,
            branch: deposit.admin.bankConfig.branch,
            contactInfo: deposit.admin.bankConfig.contactInfo
        } : null
    });
}
