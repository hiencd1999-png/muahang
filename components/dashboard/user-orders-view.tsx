"use client";

import { formatCurrency, formatDate } from "@/lib/format";
import { StatusPill } from "@/components/shared/status-pill";
import { UserOrderActions } from "@/components/dashboard/user-order-actions";

interface Order {
  id: number;
  productLink: string;
  productName: string;
  shopId: string | null;
  quantity: number;
  total: number;
  status: string;
  createdAt: Date;
}

export function UserOrdersView({ orders }: { orders: Order[] }) {
  return (
    <section className="panel rounded-[1.75rem] p-4 sm:p-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-950">Lịch sử đơn</h2>
        <p className="mt-1 text-sm text-slate-600">Toàn bộ đơn của tài khoản hiện tại.</p>
      </div>
      <div className="mt-5">
        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500 border-b border-slate-200/70">
              <tr>
                <th className="pb-3 pl-0">ID</th>
                <th className="pb-3">Sản phẩm</th>
                <th className="pb-3">Shop ID</th>
                <th className="pb-3">SL</th>
                <th className="pb-3">Tổng tiền</th>
                <th className="pb-3">Trạng thái</th>
                <th className="pb-3">Ngày</th>
                <th className="pb-3">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-amber-50/30">
                  <td className="py-4 pl-0 font-medium text-slate-900 whitespace-nowrap">#{order.id}</td>
                  <td className="py-4 text-slate-600 max-w-[250px] truncate text-sm">{order.productName || order.productLink}</td>
                  <td className="py-4 text-slate-600 whitespace-nowrap">{order.shopId || "-"}</td>
                  <td className="py-4 text-slate-700">{order.quantity}</td>
                  <td className="py-4 text-slate-700 font-semibold">{formatCurrency(order.total)}</td>
                  <td className="py-4"><StatusPill status={order.status} /></td>
                  <td className="py-4 text-slate-600 text-xs whitespace-nowrap">{formatDate(order.createdAt)}</td>
                  <td className="py-4">
                    <UserOrderActions orderId={order.id} status={order.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="rounded-xl border border-slate-200/70 bg-white/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-slate-900">#{order.id}</span>
                    <StatusPill status={order.status} />
                  </div>
                  <p className="text-sm text-slate-600 truncate mb-2">{order.productName || order.productLink}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mb-3">
                    <div>Shop ID: {order.shopId || "-"}</div>
                    <div>SL: {order.quantity}</div>
                    <div className="col-span-2">Tổng: {formatCurrency(order.total)}</div>
                    <div className="col-span-2 text-slate-500">{formatDate(order.createdAt)}</div>
                  </div>
                  <UserOrderActions orderId={order.id} status={order.status} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {orders.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-slate-500">Chưa có đơn nào.</p>
          </div>
        )}
      </div>
    </section>
  );
}
