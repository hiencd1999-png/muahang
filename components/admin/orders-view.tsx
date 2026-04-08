"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { formatCurrency, formatDate } from "@/lib/format";
import { StatusPill } from "@/components/shared/status-pill";
import { OrderActions } from "@/components/admin/order-actions";
import { AdvancedFilterPanel } from "@/components/admin/advanced-filter";
import { Pagination } from "@/components/shared/pagination";
import { useToast } from "@/components/shared/toast";

interface Order {
  id: number;
  userId: number;
  productLink: string;
  productName: string;
  shopId: string | null;
  quantity: number;
  total: number;
  status: string;
  user: { username: string };
  createdAt: Date;
}

export function AdminOrdersView({
  orders,
  totalCount,
  totalPages,
  page,
}: {
  orders: Order[];
  totalCount: number;
  totalPages: number;
  page: number;
}) {
  const { addToast } = useToast();
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState("");
  const [showModal, setShowModal] = useState(false);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedIds(orders.map((o) => o.id));
  };

  const clearAll = () => {
    setSelectedIds([]);
  };

  const handleBatchAction = async () => {
    if (!action || selectedIds.length === 0) return;

    setLoading(true);

    try {
      const status = action.split("_")[1].toUpperCase();

      const response = await fetch("/api/admin/orders/batch-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: selectedIds, status }),
      });

      const result = await response.json();

      if (!response.ok) {
        addToast("error", result.error || "Thao tác thất bại");
      } else {
        addToast("success", result.message);
        setAction("");
        clearAll();
        router.refresh();
      }
    } catch (error) {
      addToast("error", "Lỗi khi thực hiện thao tác");
      console.error(error);
    } finally {
      setLoading(false);
      setShowModal(false);
    }
  };

  const searchParams = useSearchParams();
  const currentQuery = searchParams.get("q") || "";
  const currentStatus = searchParams.get("status") || "";

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = formData.get("q") as string;
    const status = formData.get("status") as string;

    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (status) params.set("status", status);
    params.set("page", "1");

    router.push(`/admin/orders?${params.toString()}`);
  };

  return (
    <section className="panel rounded-[1.75rem] p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-slate-950">Quản lý đơn hàng</h2>
        <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row sm:gap-2">
          <input
            name="q"
            placeholder="Tìm username hoặc link..."
            defaultValue={currentQuery}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 sm:w-48"
          />
          <select
            name="status"
            defaultValue={currentStatus}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="PENDING">Chờ xử lý</option>
            <option value="PROCESSING">Đang xử lý</option>
            <option value="COMPLETED">Hoàn thành</option>
            <option value="CANCELED">Đã hủy</option>
          </select>
          <button
            type="submit"
            className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Tìm
          </button>
        </form>
      </div>

      <AdvancedFilterPanel filterType="orders" />

      {/* Batch Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-center justify-between gap-4">
          <div className="text-sm font-medium text-amber-900">
            {selectedIds.length} / {orders.length} được chọn
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={selectedIds.length === orders.length ? clearAll : selectAll}
              className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50"
            >
              {selectedIds.length === orders.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
            </button>
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                if (e.target.value) setShowModal(true);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
            >
              <option value="">-- Chọn thao tác --</option>
              <option value="status_pending">Đặt lại Chờ xử lý</option>
              <option value="status_processing">Đổi thành Đang xử lý</option>
              <option value="status_completed">Đánh dấu Hoàn thành</option>
              <option value="status_canceled">Hủy đơn</option>
            </select>
          </div>
        </div>
      )}

      {/* Tables */}
      <div className="mt-5">
        <div className="hidden lg:block overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="pb-3 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === orders.length && orders.length > 0}
                    onChange={(e) => (e.target.checked ? selectAll() : clearAll())}
                    className="rounded"
                  />
                </th>
                <th className="pb-3">ID</th>
                <th className="pb-3">User</th>
                <th className="pb-3">Sản phẩm</th>
                <th className="pb-3">Shop ID</th>
                <th className="pb-3">SL</th>
                <th className="pb-3">Tổng</th>
                <th className="pb-3">Trạng thái</th>
                <th className="pb-3">Ngày</th>
                <th className="pb-3">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-amber-50/30">
                  <td className="py-4 px-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(order.id)}
                      onChange={() => toggleSelect(order.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="py-4 font-medium text-slate-900">#{order.id}</td>
                  <td className="py-4 text-slate-700">{order.user.username}</td>
                  <td className="py-4 text-slate-600 max-w-xs truncate text-xs">{order.productName || order.productLink}</td>
                  <td className="py-4 text-slate-600">{order.shopId || "-"}</td>
                  <td className="py-4 text-slate-700">{order.quantity}</td>
                  <td className="py-4 text-slate-700 font-semibold">{formatCurrency(order.total)}</td>
                  <td className="py-4">
                    <StatusPill status={order.status} />
                  </td>
                  <td className="py-4 text-slate-600 text-xs">{formatDate(order.createdAt)}</td>
                  <td className="py-4">
                    <OrderActions orderId={order.id} status={order.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="lg:hidden space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="rounded-xl border border-slate-200 bg-white/70 p-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(order.id)}
                  onChange={() => toggleSelect(order.id)}
                  className="rounded mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">#{order.id}</span>
                    <StatusPill status={order.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{order.user.username}</p>
                  <p className="text-xs text-slate-600 truncate">{order.productName || order.productLink}</p>
                  <p className="mt-1 text-xs text-slate-500">Shop ID: {order.shopId || "-"}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(order.total)}</p>
                  <p className="text-xs text-slate-500">{formatDate(order.createdAt)}</p>
                  <div className="mt-2">
                    <OrderActions orderId={order.id} status={order.status} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Pagination currentPage={page} totalPages={totalPages} baseUrl="/admin/orders" />

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-lg bg-white p-6 max-w-sm">
            <h3 className="text-lg font-semibold text-slate-900">Xác nhận thao tác</h3>
            <p className="mt-2 text-sm text-slate-600">
              Bạn sắp thực hiện thao tác trên {selectedIds.length} đơn hàng. Hành động này không thể hoàn tác.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setAction("");
                }}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleBatchAction}
                disabled={loading}
                className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {loading ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
