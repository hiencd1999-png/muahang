import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { DepositForm } from "@/components/dashboard/deposit-form";

export default async function DepositPage() {
  const user = await requireUser();

  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id, type: "DEPOSIT" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const rateConfig = await prisma.systemConfig.findUnique({ where: { key: "USDT_RATE" } });
  const usdtRate = rateConfig?.value ? parseInt(rateConfig.value.replace(/[^0-9]/g, ''), 10) || 25500 : 25500;

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <DepositForm usdtRate={usdtRate} />
      <section className="panel rounded-[1.75rem] p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Lịch sử nạp tiền</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{formatCurrency(user.balance)}</p>
        </div>
        <div className="mt-5 space-y-3">
          {transactions.map((transaction) => (
            <div key={transaction.id} className="rounded-2xl bg-white/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{transaction.note}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(transaction.createdAt)}</p>
                </div>
                <p className={`text-sm font-semibold ${transaction.amount >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {transaction.amount >= 0 ? "+" : ""}
                  {formatCurrency(transaction.amount)}
                </p>
              </div>
            </div>
          ))}
          {transactions.length === 0 ? <p className="text-sm text-slate-500">Chưa có giao dịch nào.</p> : null}
        </div>
      </section>
    </div>
  );
}
