import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { Pagination } from "@/components/shared/pagination";

const ITEMS_PER_PAGE = 20;

export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireUser("ADMIN");
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));

  const [transactions, totalCount] = await Promise.all([
    prisma.transaction.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE,
    }),
    prisma.transaction.count(),
  ]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <section className="panel rounded-[1.75rem] p-4 sm:p-6">
      <h2 className="text-xl font-semibold text-slate-950">Transactions</h2>
      <div className="mt-5">
        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-3">ID</th>
                <th className="pb-3">User</th>
                <th className="pb-3">Loại</th>
                <th className="pb-3">Ghi chú</th>
                <th className="pb-3">Số tiền</th>
                <th className="pb-3">Ngày</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="border-t border-slate-200/70 align-top">
                  <td className="py-4 font-medium text-slate-900">#{transaction.id}</td>
                  <td className="py-4 text-slate-700">{transaction.user.username}</td>
                  <td className="py-4 text-slate-600">{transaction.type}</td>
                  <td className="py-4 text-slate-600 max-w-xs truncate">{transaction.note}</td>
                  <td className={`py-4 font-medium ${transaction.amount >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {transaction.amount >= 0 ? "+" : ""}
                    {formatCurrency(transaction.amount)}
                  </td>
                  <td className="py-4 text-slate-600">{formatDate(transaction.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-4">
          {transactions.map((transaction) => (
            <div key={transaction.id} className="rounded-xl border border-slate-200/70 bg-white/70 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">#{transaction.id}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{transaction.type}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">User: {transaction.user.username}</p>
                  <p className="mt-1 text-sm text-slate-600 truncate max-w-xs">{transaction.note}</p>
                  <p className={`mt-1 text-sm font-medium ${transaction.amount >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {transaction.amount >= 0 ? "+" : ""}
                    {formatCurrency(transaction.amount)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(transaction.createdAt)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Pagination currentPage={page} totalPages={totalPages} baseUrl="/admin/transactions" />
    </section>
  );
}
