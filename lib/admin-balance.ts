import { prisma } from "@/lib/prisma";

export async function getLockedAdminCommission(adminId: number, tx: any = prisma): Promise<number> {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  
  const lockedOrders = await tx.order.findMany({
    where: {
      approvedByAdminId: adminId,
      status: "DELIVERED",
      complaintStatus: { not: "APPROVED" },
      OR: [
        { updatedAt: { gte: threeDaysAgo } },
        { complaintStatus: "PENDING" }
      ]
    },
    select: { total: true }
  });

  return lockedOrders.reduce((sum: number, o: any) => sum + Math.floor(o.total * 0.95), 0);
}

export async function getPendingWithdrawals(adminId: number, tx: any = prisma): Promise<number> {
    const pendingWithdrawals = await tx.withdrawal.aggregate({
        where: { userId: adminId, status: "PENDING" },
        _sum: { amount: true }
    });
    return pendingWithdrawals._sum?.amount || 0;
}
