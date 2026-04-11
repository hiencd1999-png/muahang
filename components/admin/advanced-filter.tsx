"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export interface AdvancedFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  userId?: string;
  voucherCode?: string;
}

export function AdvancedFilterPanel({
  filterType = "orders",
  onFilterChange,
}: {
  filterType?: "orders" | "users" | "transactions";
  onFilterChange?: (filters: AdvancedFilters) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);

  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";
  const status = searchParams.get("status") || "";
  const userId = searchParams.get("userId") || "";
  const voucherCode = searchParams.get("voucherCode") || "";

  const handleApplyFilters = () => {
    const params = new URLSearchParams(searchParams);

    if (dateFrom) params.set("dateFrom", dateFrom);
    else params.delete("dateFrom");

    if (dateTo) params.set("dateTo", dateTo);
    else params.delete("dateTo");

    if (status) params.set("status", status);
    else params.delete("status");

    if (userId) params.set("userId", userId);
    else params.delete("userId");

    if (voucherCode) params.set("voucherCode", voucherCode);
    else params.delete("voucherCode");

    params.set("page", "1");

    onFilterChange?.({ dateFrom, dateTo, status, userId, voucherCode });
    router.push(`?${params.toString()}`);
    setIsOpen(false);
  };

  const handleClearFilters = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("dateFrom");
    params.delete("dateTo");
    params.delete("status");
    params.delete("userId");
    params.delete("voucherCode");
    params.set("page", "1");
    router.push(`?${params.toString()}`);
    setIsOpen(false);
  };

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M3 3a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-.293.707L13 9.414V17a1 1 0 01-.293.707l-2 2A1 1 0 108.586 19h2.828a1 1 0 00.707-.293l2-2A1 1 0 0013 16v-6.586l2.707-2.707A1 1 0 0016 5V3a1 1 0 00-1-1H4a1 1 0 00-1 1v2a1 1 0 00.293.707L6 9.414V17a1 1 0 00.293.707l2 2a1 1 0 001.414-1.414V9.414L3.293 3.707A1 1 0 003 3z"
            clipRule="evenodd"
          />
        </svg>
        Bộ lọc nâng cao
      </button>

      {isOpen && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white/80 p-4 space-y-4">
          {/* Date range filters */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Từ ngày
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  const newParams = new URLSearchParams(searchParams);
                  newParams.set("dateFrom", e.target.value);
                  router.push(`?${newParams.toString()}`);
                }}
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Đến ngày
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  const newParams = new URLSearchParams(searchParams);
                  newParams.set("dateTo", e.target.value);
                  router.push(`?${newParams.toString()}`);
                }}
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
              />
            </label>
          </div>

          {/* Status and Voucher filters for orders */}
          {filterType === "orders" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Trạng thái
                <select
                  value={status}
                  onChange={(e) => {
                    const newParams = new URLSearchParams(searchParams);
                    if (e.target.value) {
                      newParams.set("status", e.target.value);
                    } else {
                      newParams.delete("status");
                    }
                    router.push(`?${newParams.toString()}`);
                  }}
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="PENDING">Chờ xử lý</option>
                  <option value="PROCESSING">Đang xử lý</option>
                  <option value="DELIVERED">Đã giao hàng</option>
                  <option value="TRACKING_GENERATED">Đã lên mã VĐ</option>
                  <option value="ORDER_PLACED">Đã đặt đơn</option>
                  <option value="CANCELED">Đã hủy</option>
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Mã Voucher
                <input
                  type="text"
                  value={voucherCode}
                  onChange={(e) => {
                    const newParams = new URLSearchParams(searchParams);
                    if (e.target.value) {
                      newParams.set("voucherCode", e.target.value);
                    } else {
                      newParams.delete("voucherCode");
                    }
                    router.push(`?${newParams.toString()}`);
                  }}
                  placeholder="Nhập mã voucher..."
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
              </label>
            </div>
          )}

          {/* User filter for transactions */}
          {filterType === "transactions" && (
            <label className="block text-sm font-medium text-slate-700">
              User ID
              <input
                type="number"
                value={userId}
                onChange={(e) => {
                  const newParams = new URLSearchParams(searchParams);
                  if (e.target.value) {
                    newParams.set("userId", e.target.value);
                  } else {
                    newParams.delete("userId");
                  }
                  router.push(`?${newParams.toString()}`);
                }}
                placeholder="Lọc theo User ID"
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
              />
            </label>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleApplyFilters}
              className="flex-1 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
            >
              Áp dụng
            </button>
            <button
              onClick={handleClearFilters}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Xóa lọc
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
