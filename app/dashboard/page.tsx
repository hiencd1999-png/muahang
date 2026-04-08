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
        <article className="panel rounded-[1.75rem] p-4 sm:p-6">
          <p className="text-sm text-slate-500">Số dư</p>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-950">{formatCurrency(user.balance)}</p>
        </article>
        <article className="panel rounded-[1.75rem] p-4 sm:p-6">
          <p className="text-sm text-slate-500">Tổng đơn</p>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-950">{orderCount}</p>
        </article>
        <article className="panel rounded-[1.75rem] p-4 sm:p-6 sm:col-span-2 lg:col-span-1">
          <p className="text-sm text-slate-500">Tác vụ nhanh</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/dashboard/deposit" className="rounded-full bg-amber-600 px-3 py-2 text-sm font-semibold text-white sm:px-4">
              Nạp tiền
            </Link>
            <Link href="/dashboard/create-order" className="rounded-full bg-slate-950 px-3 py-2 text-sm font-semibold text-white sm:px-4">
              Tạo đơn
            </Link>
          </div>
        </article>
      </section>

      <section className="panel rounded-[1.75rem] p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-950">Đơn gần đây</h2>
            <p className="mt-1 text-sm text-slate-600">Các đơn mới nhất của tài khoản hiện tại.</p>
          </div>
          <Link href="/dashboard/orders" className="text-sm font-semibold text-amber-700">
            Xem tất cả
          </Link>
        </div>

        <div className="mt-5 space-y-4">
          {recentOrders.map((order) => (
            <div key={order.id} className="flex flex-col gap-3 rounded-xl border border-slate-200/70 bg-white/70 p-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">#{order.id}</span>
                  <StatusPill status={order.status} />
                </div>
                <p className="mt-1 text-sm text-slate-600 truncate max-w-xs sm:max-w-md">{order.productName || order.productLink}</p>
                {order.address && (
                  <p className="mt-1 text-xs text-slate-500 line-clamp-1">Địa chỉ: {order.address}</p>
                )}
                <p className="mt-1 text-xs font-medium text-amber-700">{order.voucherLabel || "Chưa có voucher"}</p>
              </div>
              <div className="text-xs text-slate-500 sm:text-right">
                {formatDate(order.createdAt)}
              </div>
            </div>
          ))}
          {recentOrders.length === 0 ? <p className="py-6 text-sm text-slate-500">Chưa có đơn nào.</p> : null}
        </div>
      </section>
    </>
  );
}
