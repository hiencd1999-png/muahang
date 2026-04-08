import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { StatusPill } from "@/components/shared/status-pill";

export default async function OrdersPage() {
  const user = await requireUser();
  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <section className="panel rounded-[1.75rem] p-4 sm:p-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-950">Lịch sử đơn</h2>
        <p className="mt-1 text-sm text-slate-600">Toàn bộ đơn của user hiện tại.</p>
      </div>
      <div className="mt-5">
        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-3">ID</th>
                <th className="pb-3">Sản phẩm</th>
                <th className="pb-3">Shop ID</th>
                <th className="pb-3">SL</th>
                <th className="pb-3">Tổng tiền</th>
                <th className="pb-3">Trạng thái</th>
                <th className="pb-3">Ngày</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-slate-200/70 align-top">
                  <td className="py-4 font-medium text-slate-900">#{order.id}</td>
                  <td className="py-4 text-slate-600 max-w-xs truncate">{order.productName || order.productLink}</td>
                  <td className="py-4 text-slate-600">{order.shopId || "-"}</td>
                  <td className="py-4 text-slate-600">{order.quantity}</td>
                  <td className="py-4 text-slate-600">{formatCurrency(order.total)}</td>
                  <td className="py-4"><StatusPill status={order.status} /></td>
                  <td className="py-4 text-slate-600">{formatDate(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="rounded-xl border border-slate-200/70 bg-white/70 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">#{order.id}</span>
                    <StatusPill status={order.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-600 truncate max-w-xs">{order.productName || order.productLink}</p>
                  <p className="mt-1 text-xs text-slate-500">Shop ID: {order.shopId || "-"}</p>
                  <p className="mt-1 text-sm text-slate-600">SL: {order.quantity} | {formatCurrency(order.total)}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(order.createdAt)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        {orders.length === 0 ? <p className="py-6 text-sm text-slate-500">Chưa có đơn nào.</p> : null}
      </div>
    </section>
  );
}
