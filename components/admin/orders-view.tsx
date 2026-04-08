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
  approvedByAdminId: number | null;
  approvedByAdminName: string | null;
  productLink: string;
  productName: string;
  shopId: string | null;
  quantity: number;
  total: number;
  status: string;
  user: { username: string; fullName?: string | null };
  createdAt: Date;
}

export function AdminOrdersView({
  orders,
  totalCount,
  totalPages,
  page,
  currentAdminId,
}: {
  orders: Order[];
  totalCount: number;
  totalPages: number;
  page: number;
  currentAdminId: number;
}) {
  const { addToast } = useToast();
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isExporting, setIsExporting] = useState(false);

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

  async function handleExportExcel() {
    if (selectedIds.length === 0) return;

    setIsExporting(true);
    try {
      const response = await fetch("/api/admin/orders/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: selectedIds }),
      });

      if (!response.ok) {
        const result = await response.json();
        addToast("error", result.error || "Không thể xuất Excel.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `admin-orders-${Date.now()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      addToast("success", "Xuất Excel thành công.");
    } catch (error) {
      addToast("error", "Lỗi khi xuất Excel.");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  }

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
    <section className="min-w-0 space-y-6">
      <div className="mb-6 grid gap-4 lg:grid-cols-[1.5fr_0.9fr] lg:items-end">
        <div className="space-y-3">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Quản lý đơn hàng</h2>
            <p className="mt-1 text-sm text-slate-500">
              Xem và xử lý đơn hàng Shopee, lọc theo trạng thái và tìm nhanh theo username hoặc link.
            </p>
          </div>
          <form onSubmit={handleSearch} className="grid gap-3 sm:grid-cols-[1.2fr_0.8fr_0.7fr_0.5fr]">
            <input
              name="q"
              placeholder="Tìm tên, username hoặc link..."
              defaultValue={currentQuery}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-500"
            />
            <select
              name="status"
              defaultValue={currentStatus}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-500"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="PENDING">Chờ xử lý</option>
              <option value="PROCESSING">Đang xử lý</option>
              <option value="ORDER_PLACED">Đã đặt đơn</option>
              <option value="TRACKING_GENERATED">Đã lên mã VĐ</option>
              <option value="DELIVERED">Đã giao hàng</option>
              <option value="CANCELED">Đã hủy</option>
            </select>
            <button
              type="submit"
              className="rounded-2xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700 transition"
            >
              Tìm
            </button>
          </form>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 shadow-sm">
            <p className="text-sm text-slate-500">Tổng đơn</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{totalCount}</p>
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Trang hiện tại</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{page}</p>
          </div>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
        <AdvancedFilterPanel filterType="orders" />
      </div>

      {selectedIds.length > 0 && (
        <div className="mb-4 rounded-[1.75rem] border border-amber-200 bg-amber-50/90 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-medium text-amber-900">
              Đã chọn {selectedIds.length} đơn hàng
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                onClick={selectedIds.length === orders.length ? clearAll : selectAll}
                className="rounded-2xl border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50"
              >
                {selectedIds.length === orders.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={isExporting}
                className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isExporting ? "Đang xuất..." : "Xuất Excel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tables */}
      <div className="mt-5 min-w-0">
        <div className="hidden lg:block overflow-x-auto rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-500">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === orders.length && orders.length > 0}
                    onChange={(e) => (e.target.checked ? selectAll() : clearAll())}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Sản phẩm</th>
                <th className="px-4 py-3">Shop ID</th>
                <th className="px-4 py-3">SL</th>
                <th className="px-4 py-3">Tổng</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Phụ trách</th>
                <th className="px-4 py-3">Ngày</th>
                <th className="px-4 py-3 w-[300px] whitespace-nowrap">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-4 align-top">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(order.id)}
                      onChange={() => toggleSelect(order.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-900 whitespace-nowrap">#{order.id}</td>
                  <td className="px-4 py-4 text-slate-700 text-sm whitespace-nowrap">{order.user.fullName || order.user.username}</td>
                  <td className="px-4 py-4 text-slate-700 max-w-[260px] truncate text-sm">{order.productName || order.productLink}</td>
                  <td className="px-4 py-4 text-slate-700 whitespace-nowrap">{order.shopId || "-"}</td>
                  <td className="px-4 py-4 text-slate-700">{order.quantity}</td>
                  <td className="px-4 py-4 text-slate-900 font-semibold">{formatCurrency(order.total)}</td>
                  <td className="px-4 py-4"><StatusPill status={order.status} /></td>
                  <td className="px-4 py-4 text-sm text-slate-600 whitespace-nowrap">
                    {order.approvedByAdminName
                      ? order.approvedByAdminId === currentAdminId
                        ? "Bạn"
                        : order.approvedByAdminName
                      : "Chưa phụ trách"}
                  </td>
                  <td className="px-4 py-4 text-slate-500 text-xs whitespace-nowrap">{formatDate(order.createdAt)}</td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <OrderActions
                      orderId={order.id}
                      status={order.status}
                      currentAdminId={currentAdminId}
                      approvedByAdminId={order.approvedByAdminId}
                      approvedByAdminName={order.approvedByAdminName}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="lg:hidden space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">#{order.id}</p>
                    <p className="text-xs text-slate-500">{formatDate(order.createdAt)}</p>
                  </div>
                  <StatusPill status={order.status} />
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Sản phẩm</p>
                  <p className="mt-2 font-medium text-slate-900 truncate">{order.productName || order.productLink}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm text-slate-700">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Khách hàng</p>
                    <p className="mt-1 font-medium text-slate-900">{order.user.fullName || order.user.username}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Shop ID</p>
                    <p className="mt-1 font-medium text-slate-900">{order.shopId || "-"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm text-slate-700">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Số lượng</p>
                    <p className="mt-1 font-medium text-slate-900">{order.quantity}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Tổng tiền</p>
                    <p className="mt-1 text-slate-900 font-semibold">{formatCurrency(order.total)}</p>
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="text-xs text-slate-500">Admin phụ trách</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {order.approvedByAdminName
                      ? order.approvedByAdminId === currentAdminId
                        ? "Bạn"
                        : order.approvedByAdminName
                      : "Chưa phụ trách"}
                  </p>
                </div>
                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(order.id)}
                      onChange={() => toggleSelect(order.id)}
                      className="rounded"
                    />
                    Chọn
                  </label>
                  <div className="max-w-full overflow-x-auto">
                    <OrderActions
                      orderId={order.id}
                      status={order.status}
                      currentAdminId={currentAdminId}
                      approvedByAdminId={order.approvedByAdminId}
                      approvedByAdminName={order.approvedByAdminName}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Pagination currentPage={page} totalPages={totalPages} baseUrl="/admin/orders" />
    </section>
  );
}
