import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
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

  return (
    <WithdrawalsView 
      withdrawals={withdrawals} 
      isSpAdmin={isSpAdmin} 
      currentBalance={userObj.balance}
      pendingAmount={pendingAmount}
    />
  );
}
