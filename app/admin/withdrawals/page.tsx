import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getLockedAdminCommission } from "@/lib/admin-balance";
import { WithdrawalsView } from "./withdrawals-view";

export default async function WithdrawalsPage() {
  const userObj = await requireUser("ADMIN");
  const isSpAdmin = userObj.role === "SPADMIN";

  const withdrawals = await prisma.withdrawal.findMany({
    where: isSpAdmin ? {} : { userId: userObj.id },
    include: {
      user: { select: { username: true, fullName: true, balance: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const pendingAmount = isSpAdmin 
    ? 0 
    : withdrawals.filter(w => w.status === "PENDING").reduce((a, b) => a + b.amount, 0);

  const lockedCommission = isSpAdmin ? 0 : await getLockedAdminCommission(userObj.id);

  const rateConfig = await prisma.systemConfig.findUnique({ where: { key: "USDT_RATE" } });
  const usdtRate = rateConfig?.value ? parseInt(rateConfig.value.replace(/[^0-9]/g, ''), 10) || 25500 : 25500;

  return (
    <WithdrawalsView 
      withdrawals={withdrawals} 
      isSpAdmin={isSpAdmin} 
      currentBalance={userObj.balance}
      pendingAmount={pendingAmount}
      lockedCommission={lockedCommission}
      is2FAEnabled={userObj.twoFactorEnabled}
      usdtRate={usdtRate}
    />
  );
}
