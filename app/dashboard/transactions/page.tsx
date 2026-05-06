import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { Pagination } from "@/components/shared/pagination";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Settings2,
} from "lucide-react";

const ITEMS_PER_PAGE = 20;

const TYPE_LABELS: Record<string, string> = {
  DEPOSIT: "Nạp tiền",
  ORDER_DEBIT: "Thanh toán đơn",
  ADMIN_ADJUSTMENT: "Điều chỉnh thủ công",
  ORDER_REFUND: "Hoàn tiền đơn",
  TIKTOK_SYNC_FEE: "Phí đồng bộ TikTok",
};

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    DEPOSIT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    ORDER_DEBIT: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
    ADMIN_ADJUSTMENT: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    ORDER_REFUND: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    TIKTOK_SYNC_FEE: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[type] ?? "bg-slate-100 text-slate-700"}`}
    >
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

function TypeIcon({ type, amount }: { type: string; amount: number }) {
  if (type === "DEPOSIT") return <ArrowDownCircle size={18} className="text-emerald-500 shrink-0" />;
  if (type === "ORDER_REFUND") return <RefreshCw size={18} className="text-amber-500 shrink-0" />;
  if (type === "ADMIN_ADJUSTMENT") return <Settings2 size={18} className="text-blue-500 shrink-0" />;
  return <ArrowUpCircle size={18} className="text-rose-500 shrink-0" />;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));

  const [transactions, totalCount] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE,
    }),
    prisma.transaction.count({ where: { userId: user.id } }),
  ]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Summary stats
  const stats = await prisma.transaction.groupBy({
    by: ["type"],
    where: { userId: user.id },
    _sum: { amount: true },
  });

  const totalDeposit = stats.find((s) => s.type === "DEPOSIT")?._sum.amount ?? 0;
  const totalSpent = Math.abs(
    stats.find((s) => s.type === "ORDER_DEBIT")?._sum.amount ?? 0
  );
  const totalTiktokFee = Math.abs(
    stats.find((s) => s.type === "TIKTOK_SYNC_FEE")?._sum.amount ?? 0
  );
  const totalRefund = stats.find((s) => s.type === "ORDER_REFUND")?._sum.amount ?? 0;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="panel rounded-2xl p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700/80 shadow-sm flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Nạp tiền
          </p>
          <p className="mt-2 text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 break-words">
            +{formatCurrency(totalDeposit)}
          </p>
        </div>
        <div className="panel rounded-2xl p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700/80 shadow-sm flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Đã chi
          </p>
          <p className="mt-2 text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 break-words">
            -{formatCurrency(totalSpent)}
          </p>
        </div>
        <div className="panel rounded-2xl p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700/80 shadow-sm flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Hoàn tiền
          </p>
          <p className="mt-2 text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 break-words">
            +{formatCurrency(totalRefund)}
          </p>
        </div>
        <div className="panel rounded-2xl p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700/80 shadow-sm flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Phí TikTok
          </p>
          <p className="mt-2 text-xl sm:text-2xl font-black text-pink-600 dark:text-pink-400 break-words">
            -{formatCurrency(totalTiktokFee)}
          </p>
        </div>
      </div>

      {/* Transaction list */}
      <section className="panel rounded-[1.75rem] p-4 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-400">
              Lịch sử giao dịch
            </p>
            <p className="mt-1 text-sm font-bold text-slate-600 dark:text-slate-300">
              {totalCount} giao dịch
            </p>
          </div>
          <span className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-700/80 px-4 py-2 text-xs font-black text-slate-900 dark:text-white shadow-sm">
            Số dư: {formatCurrency(user.balance)}
          </span>
        </div>

        {transactions.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-gray-400">
            Chưa có giao dịch nào.
          </p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-gray-400">
                    <th className="pb-3 pr-4">#</th>
                    <th className="pb-3 pr-4">Loại</th>
                    <th className="pb-3 pr-4">Ghi chú</th>
                    <th className="pb-3 pr-4 text-right">Số tiền</th>
                    <th className="pb-3 text-right">Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-t border-slate-200/70 dark:border-gray-700/50 align-top"
                    >
                      <td className="py-3 pr-4 font-mono text-slate-400 dark:text-gray-500 text-xs">
                        #{tx.id}
                      </td>
                      <td className="py-3 pr-4">
                        <TypeBadge type={tx.type} />
                      </td>
                      <td className="py-3 pr-4 text-slate-700 dark:text-gray-300 max-w-xs">
                        {tx.note}
                      </td>
                      <td
                        className={`py-3 pr-4 text-right font-semibold ${
                          tx.amount >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {tx.amount >= 0 ? "+" : ""}
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="py-3 text-right text-slate-500 dark:text-gray-400 whitespace-nowrap" suppressHydrationWarning>
                        {formatDate(tx.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-4 sm:hidden">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-start gap-4 rounded-3xl bg-slate-50/50 dark:bg-slate-950/40 p-5 border border-slate-100 dark:border-slate-700/80 shadow-sm"
                >
                  <TypeIcon type={tx.type} amount={tx.amount} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <TypeBadge type={tx.type} />
                      <span
                        className={`font-semibold text-sm shrink-0 ${
                          tx.amount >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {tx.amount >= 0 ? "+" : ""}
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700 dark:text-gray-300 truncate">
                      {tx.note}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-gray-500" suppressHydrationWarning>
                      {formatDate(tx.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Pagination currentPage={page} totalPages={totalPages} baseUrl="/dashboard/transactions" />
          </>
        )}
      </section>
    </div>
  );
}
