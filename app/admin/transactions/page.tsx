import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { Pagination } from "@/components/shared/pagination";
import { ArrowDownCircle, ArrowUpCircle, RefreshCw, Search, Settings2 } from "lucide-react";

const PAGE_SIZE_OPTIONS = [20, 50, 100, 500] as const;

function getPageSize(value?: string) {
  const parsed = Number.parseInt(value || "20", 10);
  return PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number]) ? parsed : 20;
}

const TYPE_LABELS: Record<string, string> = {
  DEPOSIT: "Nạp tiền",
  ORDER_DEBIT: "Thanh toán đơn",
  ADMIN_ADJUSTMENT: "Điều chỉnh thủ công",
  ORDER_REFUND: "Hoàn tiền đơn",
  WITHDRAWAL: "Rút tiền Crypto",
};

const TYPE_STYLES: Record<string, string> = {
  DEPOSIT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  ORDER_DEBIT: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  ADMIN_ADJUSTMENT: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  ORDER_REFUND: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  WITHDRAWAL: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
};

function typeLabel(type: string) {
  return TYPE_LABELS[type] ?? type;
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${TYPE_STYLES[type] ?? "bg-slate-100 text-slate-700"}`}>
      {typeLabel(type)}
    </span>
  );
}

function TypeIcon({ type }: { type: string }) {
  if (type === "DEPOSIT") return <ArrowDownCircle size={18} className="shrink-0 text-emerald-500" />;
  if (type === "ORDER_REFUND") return <RefreshCw size={18} className="shrink-0 text-amber-500" />;
  if (type === "ADMIN_ADJUSTMENT") return <Settings2 size={18} className="shrink-0 text-blue-500" />;
  if (type === "WITHDRAWAL") return <ArrowUpCircle size={18} className="shrink-0 text-purple-500" />;
  return <ArrowUpCircle size={18} className="shrink-0 text-rose-500" />;
}

export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; q?: string; type?: string }>;
}) {
  await requireUser("SPADMIN");
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = getPageSize(params.pageSize);
  const query = params.q?.trim() || "";
  const type = params.type || "";

  const where = {
    ...(type ? { type: type as any } : {}),
    ...(query
      ? {
          OR: [
            { note: { contains: query } },
            { user: { username: { contains: query } } },
            { user: { fullName: { contains: query } } },
          ],
        }
      : {}),
  };

  const [transactions, totalCount] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.transaction.count({ where }),
  ]);

  const [summary, uniqueUsers] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["type"],
      where,
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.transaction.findMany({
      where,
      distinct: ["userId"],
      select: { userId: true },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);
  const totalDeposit = summary.find((item) => item.type === "DEPOSIT")?._sum.amount ?? 0;
  const totalDebit = Math.abs(summary.find((item) => item.type === "ORDER_DEBIT")?._sum.amount ?? 0);
  const totalAdjustment = summary.find((item) => item.type === "ADMIN_ADJUSTMENT")?._sum.amount ?? 0;

  return (
    <section className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Giao dịch hệ thống
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">Theo dõi toàn bộ giao dịch</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Chỉ SPADMIN được xem màn này. Bạn có thể lọc theo user, họ tên, ghi chú hoặc loại giao dịch.
            </p>
          </div>

          <form className="grid gap-3 sm:grid-cols-[1.2fr_0.8fr_0.8fr_0.5fr]">
            <label className="relative block">
              <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                name="q"
                defaultValue={query}
                placeholder="Tìm theo username, họ tên hoặc ghi chú..."
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-3 pl-11 pr-4 text-sm outline-none focus:border-amber-500 dark:text-white"
              />
            </label>
            <select
              name="type"
              defaultValue={type}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm outline-none focus:border-amber-500 dark:text-white"
            >
              <option value="">Tất cả loại giao dịch</option>
              <option value="DEPOSIT">Nạp tiền</option>
              <option value="ORDER_DEBIT">Thanh toán đơn</option>
              <option value="ADMIN_ADJUSTMENT">Điều chỉnh thủ công</option>
              <option value="ORDER_REFUND">Hoàn tiền đơn</option>
              <option value="WITHDRAWAL">Rút tiền Crypto</option>
            </select>
            <select
              name="pageSize"
              defaultValue={String(pageSize)}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm outline-none focus:border-amber-500 dark:text-white"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} mục / trang
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-2xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-700"
            >
              Lọc
            </button>
          </form>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
          <div className="rounded-[1.5rem] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <p className="text-sm text-slate-500 dark:text-slate-400">Tổng giao dịch</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{totalCount}</p>
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <p className="text-sm text-slate-500 dark:text-slate-400">Số user phát sinh</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{uniqueUsers.length}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="panel rounded-[1.75rem] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tổng nạp tiền</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">+{formatCurrency(totalDeposit)}</p>
        </article>
        <article className="panel rounded-[1.75rem] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tổng thanh toán đơn</p>
          <p className="mt-2 text-2xl font-semibold text-rose-700">-{formatCurrency(totalDebit)}</p>
        </article>
        <article className="panel rounded-[1.75rem] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tổng điều chỉnh thủ công</p>
          <p className={`mt-2 text-2xl font-semibold ${totalAdjustment >= 0 ? "text-blue-700" : "text-rose-700"}`}>
            {totalAdjustment >= 0 ? "+" : ""}
            {formatCurrency(totalAdjustment)}
          </p>
        </article>
      </div>

      <section className="panel rounded-[1.75rem] p-4 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Danh sách giao dịch</p>
            <p className="mt-1 text-sm text-slate-500">
              {query || type ? "Kết quả sau khi lọc giao dịch." : "Toàn bộ giao dịch trong hệ thống."}
            </p>
          </div>
          {(query || type) ? (
            <a
              href={`/admin/transactions?pageSize=${pageSize}`}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Xóa lọc
            </a>
          ) : null}
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
            Hiển thị: {pageSize} mục / trang
          </span>
          {query ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              Từ khóa: {query}
            </span>
          ) : null}
          {type ? (
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
              Loại: {typeLabel(type)}
            </span>
          ) : null}
        </div>

        {transactions.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-10 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">Không có giao dịch nào phù hợp với bộ lọc hiện tại.</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-[1.5rem] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm lg:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Mã GD</th>
                    <th className="px-4 py-3">Người dùng</th>
                    <th className="px-4 py-3">Loại giao dịch</th>
                    <th className="px-4 py-3">Ghi chú</th>
                    <th className="px-4 py-3 text-right">Số tiền</th>
                    <th className="px-4 py-3 text-right">Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="border-t border-slate-200/70 dark:border-slate-700/70 align-top hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition">
                      <td className="px-4 py-4 font-mono text-xs font-semibold text-slate-900 dark:text-white">#{transaction.id}</td>
                      <td className="px-4 py-4 text-slate-700 dark:text-slate-300">
                        <div className="space-y-1">
                          <p className="font-medium text-slate-900 dark:text-white">{transaction.user.fullName || transaction.user.username}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">@{transaction.user.username}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                        <TypeBadge type={transaction.type} />
                      </td>
                      <td className="max-w-md px-4 py-4 text-slate-600 dark:text-slate-300">{transaction.note}</td>
                      <td className={`px-4 py-4 text-right font-semibold ${transaction.amount >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                        {transaction.amount >= 0 ? "+" : ""}
                        {formatCurrency(transaction.amount)}
                      </td>
                      <td className="px-4 py-4 text-right text-slate-500 dark:text-slate-400">{formatDate(transaction.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-4 lg:hidden">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="rounded-[1.5rem] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <TypeIcon type={transaction.type} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">#{transaction.id}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">@{transaction.user.username}</p>
                        </div>
                        <TypeBadge type={transaction.type} />
                      </div>
                      <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">{transaction.user.fullName || transaction.user.username}</p>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{transaction.note}</p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className={`text-sm font-semibold ${transaction.amount >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                          {transaction.amount >= 0 ? "+" : ""}
                          {formatCurrency(transaction.amount)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(transaction.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <Pagination currentPage={page} totalPages={totalPages} baseUrl="/admin/transactions" />
      </section>
    </section>
  );
}
