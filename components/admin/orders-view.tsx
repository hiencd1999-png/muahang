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
  voucherLabel?: string | null;
  status: string;
  complaintStatus?: string | null;
  user: { username: string; fullName?: string | null };
  createdAt: Date;
  variant: string | null;
  address: string;
  isLockerPickup?: boolean;
}

interface AssignableAdmin {
  id: number;
  username: string;
  fullName: string | null;
  role: "ADMIN" | "SPADMIN";
}

import { AdminGuideModal } from "@/components/admin/admin-guide-modal";

export function AdminOrdersView({
  orders,
  totalCount,
  totalPages,
  page,
  currentAdminId,
  canManageAllOrders,
  assignableAdmins,
}: {
  orders: Order[];
  totalCount: number;
  totalPages: number;
  page: number;
  currentAdminId: number;
  canManageAllOrders: boolean;
  assignableAdmins: AssignableAdmin[];
}) {
  const { addToast } = useToast();
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  async function handleDeleteOrders() {
    if (!canManageAllOrders || selectedIds.length === 0) return;

    const confirmed = window.confirm(`Xác nhận xóa ${selectedIds.length} đơn đã chọn? Hành động này không thể hoàn tác.`);
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const response = await fetch("/api/admin/orders/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: selectedIds }),
      });

      const result = await response.json();
      if (!response.ok) {
        addToast("error", result.error || "Không thể xóa đơn hàng.");
        return;
      }

      addToast("success", `Đã xóa ${result.deleted ?? selectedIds.length} đơn hàng.`);
      setSelectedIds([]);
      router.refresh();
    } catch {
      addToast("error", "Có lỗi khi xóa đơn hàng.");
    } finally {
      setIsDeleting(false);
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

  const getShortAddress = (fullAddress: string) => {
    if (!fullAddress) return "-";
    const cleanAddress = fullAddress.replace(/\n/g, " ").trim();
    if (cleanAddress.length <= 50) return cleanAddress;
    return cleanAddress.substring(0, 50) + "...";
  };

  return (
    <section className="min-w-0 space-y-6">
      <div className="mb-6 grid gap-4 lg:grid-cols-[1.5fr_0.9fr] lg:items-end">
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pr-2">
            <div>
              <h2 className="text-2xl font-black text-slate-950 dark:text-white tracking-tight">Quản lý đơn hàng</h2>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-200">
                Xem và xử lý đơn hàng Shopee, lọc theo trạng thái và tìm nhanh theo username hoặc link.
              </p>
            </div>
            <AdminGuideModal />
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
              {canManageAllOrders ? (
                <button
                  type="button"
                  onClick={handleDeleteOrders}
                  disabled={isDeleting}
                  className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isDeleting ? "Đang xóa..." : "Xóa đơn"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Tables */}
      <div className="mt-5 min-w-0">
        <div className="hidden lg:block overflow-x-auto rounded-[1.5rem] border border-slate-200 bg-white shadow-sm w-full">
          <table className="min-w-[1400px] text-center text-sm border-collapse">
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
                <th className="px-4 py-3 whitespace-nowrap">ID</th>
                <th className="px-4 py-3 whitespace-nowrap">User</th>
                <th className="px-4 py-3 whitespace-nowrap min-w-[300px]">Địa chỉ</th>
                <th className="px-4 py-3 whitespace-nowrap min-w-[150px]">Phân loại</th>
                <th className="px-4 py-3 whitespace-nowrap">Voucher</th>
                <th className="px-4 py-3 whitespace-nowrap">Trạng thái</th>
                <th className="px-4 py-3 whitespace-nowrap">Phụ trách</th>
                <th className="px-4 py-3 whitespace-nowrap">Ngày</th>
                <th className="px-4 py-3 whitespace-nowrap w-[250px]">Hành động</th>
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
                  <td className="px-4 py-4 text-slate-700 text-sm whitespace-nowrap">
                    {canManageAllOrders || order.approvedByAdminId === currentAdminId ? (order.user.fullName || order.user.username) : "***"}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <div className="flex flex-col items-center">
                      {canManageAllOrders || order.approvedByAdminId === currentAdminId ? (
                        <p className="font-medium text-slate-900 whitespace-nowrap truncate max-w-[280px]">{getShortAddress(order.address)}</p>
                      ) : (
                        <p className="font-medium text-amber-600 italic whitespace-nowrap truncate max-w-[280px]">Nhận đơn để xem địa chỉ</p>
                      )}
                      {order.isLockerPickup && (
                        <span className="mt-1 mb-1 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 w-fit">📦 Tủ nhận hàng / Điểm GS</span>
                      )}
                      {!order.productName?.includes("Đơn gộp") && (
                        <p className="mt-1 truncate text-xs text-slate-500 max-w-[250px]">{order.productName || order.productLink}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-600 font-medium text-xs whitespace-nowrap truncate max-w-[150px]">
                    {order.variant || "-"}
                  </td>
                  <td className="px-4 py-4 text-slate-900 font-semibold text-xs whitespace-nowrap">{order.voucherLabel || formatCurrency(order.total)}</td>
                  <td className="px-4 py-4">
                    <div className="flex justify-center">
                      <StatusPill status={order.status} />
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600 whitespace-nowrap text-center">
                    {order.approvedByAdminName
                      ? order.approvedByAdminId === currentAdminId
                        ? "Bạn"
                        : order.approvedByAdminName
                      : "Chưa phụ trách"}
                  </td>
                  <td className="px-4 py-4 text-slate-500 text-xs whitespace-nowrap" suppressHydrationWarning>{formatDate(order.createdAt)}</td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex justify-center">
                      <OrderActions
                        orderId={order.id}
                        status={order.status}
                        complaintStatus={order.complaintStatus}
                        currentAdminId={currentAdminId}
                        canManageAllOrders={canManageAllOrders}
                        approvedByAdminId={order.approvedByAdminId}
                        approvedByAdminName={order.approvedByAdminName}
                        assignableAdmins={assignableAdmins}
                      />
                    </div>
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
                    <p className="text-xs text-slate-500" suppressHydrationWarning>{formatDate(order.createdAt)}</p>
                  </div>
                  <StatusPill status={order.status} />
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Địa chỉ</p>
                  {canManageAllOrders || order.approvedByAdminId === currentAdminId ? (
                    <p className="mt-2 font-semibold text-slate-900 whitespace-nowrap truncate">{getShortAddress(order.address)}</p>
                  ) : (
                    <p className="mt-2 font-medium text-amber-600 italic whitespace-nowrap truncate">Nhận đơn để xem địa chỉ</p>
                  )}
                  {order.isLockerPickup && (
                    <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 w-fit">📦 Nhận tại Tủ / Điểm nhận hàng</span>
                  )}
                  {!order.productName?.includes("Đơn gộp") && (
                    <p className="mt-1 text-xs text-slate-500 truncate">{order.productName || order.productLink}</p>
                  )}
                </div>
                <div className="rounded-2xl bg-amber-50/50 border border-amber-100 p-3">
                  <p className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">Phân loại</p>
                  <p className="mt-1 text-sm font-medium text-slate-800 whitespace-nowrap truncate">{order.variant || "-"}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm text-slate-700">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Khách hàng</p>
                    <p className="mt-1 font-medium text-slate-900">
                      {canManageAllOrders || order.approvedByAdminId === currentAdminId ? (order.user.fullName || order.user.username) : "***"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Voucher</p>
                    <p className="mt-1 text-slate-900 font-semibold flex items-center justify-between">
                       <span className="text-xs">{order.voucherLabel || formatCurrency(order.total)}</span>
                    </p>
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
                      complaintStatus={order.complaintStatus}
                      currentAdminId={currentAdminId}
                      canManageAllOrders={canManageAllOrders}
                      approvedByAdminId={order.approvedByAdminId}
                      approvedByAdminName={order.approvedByAdminName}
                      assignableAdmins={assignableAdmins}
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
