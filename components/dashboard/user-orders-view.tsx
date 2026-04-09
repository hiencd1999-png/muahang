"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/format";
import { StatusPill } from "@/components/shared/status-pill";
import { UserOrderActions } from "@/components/dashboard/user-order-actions";
import { useToast } from "@/components/shared/toast";

interface Order {
  id: number;
  productLink: string;
  productName: string;
  address: string;
  variant?: string | null;
  shopId: string | null;
  quantity: number;
  total: number;
  voucherLabel?: string | null;
  status: string;
  complaintStatus?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function UserOrdersView({ orders }: { orders: Order[] }) {
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const [focusedOrderId, setFocusedOrderId] = useState<number | null>(null);

  const getShortAddress = (fullAddress: string) => {
    if (!fullAddress) return "-";
    const cleanAddress = fullAddress.replace(/\n/g, " ").trim();
    if (cleanAddress.length <= 50) return cleanAddress;
    return cleanAddress.substring(0, 50) + "...";
  };
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedOrders = orders.filter((order) => selectedIds.includes(order.id));
  const canDeleteCanceled = selectedOrders.length > 0 && selectedOrders.every((order) => order.status === "CANCELED");

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => (prev.length === orders.length ? [] : orders.map((order) => order.id)));
  };

  async function readApiResponse(response: Response) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }
    return response.blob();
  }

  function triggerDownload(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleExport() {
    if (selectedIds.length === 0) return;

    setIsExporting(true);
    try {
      const response = await fetch("/api/order/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: selectedIds }),
      });
      const payload = await readApiResponse(response);

      if (!response.ok) {
        addToast("error", (payload as any).error || "Không thể xuất Excel.");
        return;
      }

      triggerDownload(payload as Blob, `user-orders-${Date.now()}.xlsx`);
      addToast("success", "Xuất Excel thành công.");
    } catch {
      addToast("error", "Có lỗi khi xuất Excel.");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDeleteCanceled() {
    if (!canDeleteCanceled) {
      addToast("error", "Chỉ có thể xóa các đơn đã hủy.");
      return;
    }

    const confirmed = window.confirm(`Xóa ${selectedIds.length} đơn đã hủy đã chọn?`);
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const response = await fetch("/api/order/delete-canceled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: selectedIds }),
      });
      const payload = await response.json();

      if (!response.ok) {
        addToast("error", payload.error || "Không thể xóa đơn đã hủy.");
        return;
      }

      addToast("success", "Đã xóa các đơn đã hủy đã chọn.");
      setSelectedIds([]);
      window.location.reload();
    } catch {
      addToast("error", "Có lỗi khi xóa đơn đã hủy.");
    } finally {
      setIsDeleting(false);
    }
  }

  useEffect(() => {
    const orderIdParam = searchParams.get("orderId");
    if (!orderIdParam) return;

    const targetOrderId = Number(orderIdParam);
    if (!Number.isFinite(targetOrderId)) return;

    setFocusedOrderId(targetOrderId);

    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(`[data-order-id="${targetOrderId}"]`)
    );
    const target = candidates.find((el) => el.offsetParent !== null) || candidates[0];
    target?.scrollIntoView({ behavior: "smooth", block: "center" });

    const timer = window.setTimeout(() => setFocusedOrderId(null), 2500);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/80 p-6 shadow-sm">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">Lịch sử đơn</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Toàn bộ đơn của tài khoản hiện tại.</p>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[1.5rem] bg-white dark:bg-slate-900 p-4 border border-slate-100 dark:border-slate-700/80 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300 font-bold">Tổng đơn</p>
            <p className="mt-4 text-3xl font-black text-slate-950 dark:text-white">{orders.length}</p>
          </div>
          <div className="rounded-[1.5rem] bg-white dark:bg-slate-900 p-4 border border-slate-100 dark:border-slate-700/80 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300 font-bold">Đơn gần nhất</p>
            <p className="mt-4 text-2xl font-black text-slate-950 dark:text-white">
              {orders[0] ? `#${orders[0].id}` : "Chưa có"}
            </p>
          </div>
        </div>
      </div>

      {selectedIds.length > 0 ? (
        <div className="rounded-[1.5rem] border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-amber-900 dark:text-amber-400 uppercase tracking-wider">Đã chọn {selectedIds.length} đơn hàng</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="rounded-2xl border border-amber-200 dark:border-amber-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-amber-700 dark:text-amber-400 transition hover:bg-amber-50 dark:hover:bg-amber-800"
              >
                {selectedIds.length === orders.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isExporting ? "Đang xuất..." : "Xuất Excel"}
              </button>
              <button
                type="button"
                onClick={handleDeleteCanceled}
                disabled={!canDeleteCanceled || isDeleting}
                className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isDeleting ? "Đang xóa..." : "Xóa đơn đã hủy"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-5 space-y-4 min-w-0">
        <div className="hidden lg:block rounded-[1.5rem] border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-sm overflow-x-auto w-full">
          <table className="min-w-[1200px] text-center text-sm border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={orders.length > 0 && selectedIds.length === orders.length}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 whitespace-nowrap">ID</th>
                <th className="px-4 py-3 whitespace-nowrap min-w-[280px]">Địa chỉ</th>
                <th className="px-4 py-3 whitespace-nowrap min-w-[150px]">Phân loại</th>
                <th className="px-4 py-3 whitespace-nowrap">Tổng tiền</th>
                <th className="px-4 py-3 whitespace-nowrap">Trạng thái</th>
                <th className="px-4 py-3 whitespace-nowrap">Ngày</th>
                <th className="px-4 py-3 whitespace-nowrap w-[220px]">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  data-order-id={order.id}
                  className={`border-t border-slate-100 dark:border-slate-700/80 transition hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                    focusedOrderId === order.id ? "bg-amber-100/40 dark:bg-amber-900/20" : ""
                  }`}
                >
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(order.id)}
                      onChange={() => toggleSelect(order.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-4 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">#{order.id}</td>
                  <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                    <div className="flex flex-col items-center">
                      <p className="font-medium text-slate-900 dark:text-white whitespace-nowrap truncate max-w-[280px]">{getShortAddress(order.address)}</p>
                      {!order.productName?.includes("Đơn gộp") && (
                        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-300 max-w-[250px]">{order.productName || order.productLink}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-600 dark:text-slate-300 font-medium text-xs whitespace-nowrap truncate max-w-[150px]">
                    {order.variant || "-"}
                  </td>
                  <td className="px-4 py-4 text-slate-800 dark:text-slate-200 font-bold leading-tight">{formatCurrency(order.total)}</td>
                  <td className="px-4 py-4">
                    <div className="flex justify-center">
                      <StatusPill status={order.status} />
                    </div>
                  </td>
                  <td className="px-4 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-300 whitespace-nowrap uppercase tracking-wider" suppressHydrationWarning>{formatDate(order.createdAt)}</td>
                  <td className="px-4 py-4">
                    <div className="flex justify-center">
                      <UserOrderActions orderId={order.id} status={order.status} complaintStatus={order.complaintStatus} updatedAt={order.updatedAt} buttonClassName="min-w-[90px] h-10 px-3 py-2 text-xs" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="lg:hidden space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              data-order-id={order.id}
              className={`rounded-[2rem] border p-5 transition-all shadow-sm ${
                focusedOrderId === order.id
                  ? "border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20"
                  : "border-slate-200/70 dark:border-slate-700/80 bg-white/50 dark:bg-slate-900/90"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-900 dark:text-white">#{order.id}</span>
                  <StatusPill status={order.status} />
                </div>
                <label className="inline-flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-800 p-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(order.id)}
                    onChange={() => toggleSelect(order.id)}
                    className="rounded"
                  />
                  Chọn
                </label>
              </div>

              <div className="mt-4 rounded-3xl bg-slate-50/50 dark:bg-slate-800/40 p-5 border border-slate-100 dark:border-slate-700/80">
                <p className="text-[10px] text-slate-400 dark:text-slate-300 font-bold uppercase tracking-wider">Địa chỉ giao hàng</p>
                <p className="mt-2 font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug">{getShortAddress(order.address)}</p>
                {!order.productName?.includes("Đơn gộp") && (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-300 line-clamp-1 italic">{order.productName || order.productLink}</p>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-4">
                  <p className="text-[10px] text-amber-700 dark:text-amber-500 font-bold uppercase tracking-wider">Tổng tiền</p>
                  <p className="mt-1 text-amber-900 dark:text-amber-200 font-black text-lg">{formatCurrency(order.total)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-100 dark:border-slate-700/80">
                  <p className="text-[10px] text-slate-500 dark:text-slate-300 font-bold uppercase tracking-wider">Ngày tạo</p>
                  <p className="mt-1 font-bold text-slate-700 dark:text-slate-300 text-xs" suppressHydrationWarning>{formatDate(order.createdAt)}</p>
                </div>
              </div>

              <div className="mt-4">
                <UserOrderActions 
                  orderId={order.id} 
                  status={order.status} 
                  complaintStatus={order.complaintStatus}
                  updatedAt={order.updatedAt}
                  buttonClassName="w-full h-12 rounded-xl text-sm font-semibold shadow-sm active:scale-[0.98] transition-transform" 
                />
              </div>
            </div>
          ))}
        </div>

        {orders.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-slate-500 dark:text-slate-300">Chưa có đơn nào.</p>
          </div>
        )}
      </div>
    </section>
  );
}
