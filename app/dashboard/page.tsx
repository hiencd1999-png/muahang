import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { StatusPill } from "@/components/shared/status-pill";

export default async function DashboardPage() {
  const user = await requireUser();

  const [orderCount, recentOrders] = await Promise.all([
    prisma.order.count({ where: { userId: user.id } }),
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article className="panel rounded-[1.75rem] p-4 sm:p-6 bg-white dark:bg-slate-900">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-200">Số dư</p>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-950 dark:text-white">{formatCurrency(user.balance)}</p>
        </article>
        <article className="panel rounded-[1.75rem] p-4 sm:p-6 bg-white dark:bg-slate-900">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-200">Tổng đơn</p>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-950 dark:text-white">{orderCount}</p>
        </article>
        <article className="panel rounded-[1.75rem] p-4 sm:p-6 bg-white dark:bg-slate-900 sm:col-span-2 lg:col-span-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-200">Tác vụ nhanh</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/dashboard/deposit" className="rounded-full bg-amber-600 px-3 py-2 text-sm font-semibold text-white sm:px-4 hover:bg-amber-700 transition active:scale-95 shadow-md shadow-amber-900/10">
              Nạp tiền
            </Link>
            <Link href="/dashboard/create-order" className="rounded-full bg-amber-600 dark:bg-amber-600 px-3 py-2 text-sm font-semibold text-white sm:px-4 hover:bg-amber-700 transition active:scale-95 shadow-md shadow-amber-900/10">
              Tạo đơn
            </Link>
          </div>
        </article>
      </section>

      <section className="panel rounded-[1.75rem] p-4 sm:p-6 bg-white dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white tracking-tight">Đơn gần đây</h2>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-300">Các đơn mới nhất của tài khoản hiện tại.</p>
          </div>
          <Link href="/dashboard/orders" className="text-sm font-semibold text-amber-700 dark:text-amber-400 hover:underline">
            Xem tất cả
          </Link>
        </div>

        <div className="mt-5 space-y-4">
          {recentOrders.map((order) => (
            <div key={order.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white/50 dark:bg-slate-800/40 p-5 sm:flex-row sm:items-center shadow-sm">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100">#{order.id}</span>
                  <StatusPill status={order.status} />
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 font-medium truncate max-w-xs sm:max-w-md">{order.productName || order.productLink}</p>
                {order.address && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-200 line-clamp-1 italic font-medium">Địa chỉ: {order.address}</p>
                )}
                <p className="mt-2 text-xs font-bold text-amber-700 dark:text-amber-500">{order.voucherLabel || "Chưa có voucher"}</p>
              </div>
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 sm:text-right bg-slate-50 dark:bg-slate-900 px-3 py-1 rounded-lg">
                {formatDate(order.createdAt)}
              </div>
            </div>
          ))}
          {recentOrders.length === 0 ? <p className="py-6 text-sm text-slate-500 dark:text-slate-400">Chưa có đơn nào.</p> : null}
        </div>
      </section>
    </>
  );
}
