"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter, ListFilter, ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Pagination } from "@/components/shared/pagination";

const PAGE_SIZE_OPTIONS = [20, 50, 100, 500] as const;

const ACTION_LABELS: Record<string, string> = {
  ADMIN_UPDATE_ORDER_LOGISTICS: "Cập nhật logistics đơn hàng",
  ADMIN_UPDATE_ORDER_STATUS_PENDING: "Đặt lại đơn hàng Chờ xử lý",
  ADMIN_UPDATE_ORDER_STATUS_PROCESSING: "Chuyển đơn sang đang xử lý",
  ADMIN_UPDATE_ORDER_STATUS_ORDER_PLACED: "Chuyển đơn sang đã đặt đơn",
  ADMIN_UPDATE_ORDER_STATUS_TRACKING_GENERATED: "Chuyển đơn sang đã lên mã vận đơn",
  ADMIN_UPDATE_ORDER_STATUS_DELIVERED: "Chuyển đơn sang đã giao hàng",
  ADMIN_UPDATE_ORDER_STATUS_CANCELED: "Hủy đơn hàng",
  ADMIN_UPDATE_USER: "Cập nhật thông tin user",
  ADMIN_ADJUST_USER_BALANCE: "Điều chỉnh số dư user",
  ADMIN_TRANSFER_BALANCE: "Admin chuyển tiền cho User",
  SPADMIN_ADJUST_BALANCE: "SPADMIN điều chỉnh số dư",
  ADMIN_EXPORT_ORDERS_EXCEL: "Xuất Excel đơn hàng",
  BULK_UPDATE_ORDERS_TO_PENDING: "Cập nhật hàng loạt sang chờ xử lý",
  BULK_UPDATE_ORDERS_TO_PROCESSING: "Cập nhật hàng loạt sang đang xử lý",
  BULK_UPDATE_ORDERS_TO_ORDER_PLACED: "Cập nhật hàng loạt sang đã đặt đơn",
  BULK_UPDATE_ORDERS_TO_TRACKING_GENERATED: "Cập nhật hàng loạt sang đã lên mã vận đơn",
  BULK_UPDATE_ORDERS_TO_DELIVERED: "Cập nhật hàng loạt sang đã giao hàng",
  BULK_UPDATE_ORDERS_TO_CANCELED: "Cập nhật hàng loạt sang đã hủy",
  BULK_ADJUST_BALANCE: "Điều chỉnh số dư hàng loạt",
  BULK_TRANSFER_BALANCE: "Admin chuyển tiền hàng loạt cho User",
  SPADMIN_TRANSFER_BALANCE: "SPADMIN chuyển tiền hàng loạt cho User",
  SPADMIN_DELETE_ORDERS: "SPADMIN xóa đơn hàng hàng loạt",
  SPADMIN_UPDATE_VOUCHER_PRICING: "SPADMIN cập nhật bảng giá Voucher",
  SPADMIN_IMPORT_SYSTEM_PROXIES: "SPADMIN nhập Proxy hệ thống",
  SPADMIN_DELETE_SYSTEM_PROXIES: "SPADMIN xóa Proxy hệ thống",
  SPADMIN_REASSIGN_ORDER_OWNER: "SPADMIN đổi Admin phụ trách đơn",
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  USER: "Người dùng",
  ORDER: "Đơn hàng",
};

function formatActionLabel(action: string) {
  if (ACTION_LABELS[action]) {
    return ACTION_LABELS[action];
  }

  return action
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatTargetType(targetType: string) {
  return TARGET_TYPE_LABELS[targetType] || targetType;
}

function formatChangedField(field: string) {
  switch (field) {
    case "password":
      return "mật khẩu";
    case "role":
      return "role";
    case "balance":
      return "số dư";
    default:
      return field;
  }
}

function formatLogDetails(details: Record<string, any>) {
  if (typeof details.username === "string" && typeof details.amountChange === "number") {
    const delta = `${details.amountChange > 0 ? "+" : ""}${new Intl.NumberFormat("vi-VN").format(details.amountChange)} VND`;
    return `${details.username}: số dư ${new Intl.NumberFormat("vi-VN").format(details.previousBalance)} -> ${new Intl.NumberFormat("vi-VN").format(details.nextBalance)} VND (${delta})`;
  }

  if (typeof details.username === "string" && details.previousRole && details.nextRole) {
    return `${details.username}: role ${details.previousRole} -> ${details.nextRole}`;
  }

  if (typeof details.username === "string" && Array.isArray(details.changedFields)) {
    return `${details.username}: cập nhật ${details.changedFields.map(formatChangedField).join(", ")}`;
  }

  if (typeof details.notes === "string") {
    return details.notes;
  }

  if (typeof details.count === "number") {
    return `${details.count} mục`;
  }

  return "Không có chi tiết bổ sung";
}

interface Log {
  id: string;
  adminId: number;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  createdAt: Date;
  admin: { username: string; id: number };
}

interface LogsViewProps {
  initialLogs: Log[];
  initialTotal: number;
  initialPage: number;
  initialPageSize: number;
  initialActions: string[];
  initialAdmins: Array<{ id: number; username: string }>;
  canViewAllLogs: boolean;
}

export function AdminLogsView({
  initialLogs,
  initialTotal,
  initialPage,
  initialPageSize,
  initialActions,
  initialAdmins,
  canViewAllLogs,
}: LogsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);

  const currentAdmin = searchParams.get("adminId") || "";
  const currentAction = searchParams.get("action") || "";
  const currentStartDate = searchParams.get("startDate") || "";
  const currentEndDate = searchParams.get("endDate") || "";
  const currentPageSize = searchParams.get("pageSize") || String(initialPageSize);
  const hasActiveFilters = Boolean(currentAdmin || currentAction || currentStartDate || currentEndDate);
  const totalPages = Math.ceil(initialTotal / initialPageSize);

  const handleFilterChange = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    const adminId = formData.get("adminId");
    const action = formData.get("action");
    const startDate = formData.get("startDate");
    const endDate = formData.get("endDate");
    const pageSize = formData.get("pageSize");

    if (adminId) params.set("adminId", String(adminId));
    if (action) params.set("action", String(action));
    if (startDate) params.set("startDate", String(startDate));
    if (endDate) params.set("endDate", String(endDate));
    if (pageSize) params.set("pageSize", String(pageSize));
    params.set("page", "1");

    router.push(`/admin/logs?${params.toString()}`);
  };

  const handleClearFilters = () => {
    router.push(`/admin/logs?pageSize=${currentPageSize}`);
    setShowFilters(false);
  };

  return (
    <section className="panel rounded-[1.75rem] p-4 sm:p-6 shadow-sm">
      <div className="mb-6 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
              Nhật ký hệ thống
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
              Nhật ký hoạt động quản trị
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-200">
              {canViewAllLogs
                ? "SPADMIN có thể xem toàn bộ nhật ký hoạt động của hệ thống."
                : "Bạn chỉ xem được nhật ký do chính tài khoản admin của bạn tạo ra."}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700/80 dark:bg-slate-900/80">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                Tổng log
              </p>
              <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{initialTotal}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700/80 dark:bg-slate-900/80">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                Trang hiện tại
              </p>
              <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{initialPage}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700/80 dark:bg-slate-900/80">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                Chế độ xem
              </p>
              <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                <ShieldCheck size={16} />
                {canViewAllLogs ? "Toàn hệ thống" : "Cá nhân"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-700/80 dark:bg-slate-900/80 shadow-inner">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-white p-2 text-slate-700 dark:bg-slate-950 dark:text-gray-200 border dark:border-slate-700/80 shadow-sm">
                <ListFilter size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Bộ lọc nhật ký</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                  Lọc theo thao tác, khoảng thời gian và {canViewAllLogs ? "admin thực hiện" : "nhật ký của bạn"}.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 dark:border-slate-700/80 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800 shadow-sm"
            >
              <Filter size={16} />
              {showFilters ? "Ẩn bộ lọc" : "Mở bộ lọc"}
            </button>
          </div>

          {showFilters ? (
            <form
              onSubmit={handleFilterChange}
              className="mt-4 space-y-4 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700/80 dark:bg-slate-950 shadow-sm"
            >
              <div className={`grid grid-cols-1 gap-3 ${canViewAllLogs ? "sm:grid-cols-2 xl:grid-cols-5" : "sm:grid-cols-2 xl:grid-cols-4"}`}>
                {canViewAllLogs ? (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Admin thực hiện
                    </label>
                    <select
                      name="adminId"
                      defaultValue={currentAdmin}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    >
                      <option value="">Tất cả admin</option>
                      {initialAdmins.map((admin) => (
                        <option key={admin.id} value={admin.id}>
                          {admin.username}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Loại thao tác
                  </label>
                  <select
                    name="action"
                    defaultValue={currentAction}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="">Tất cả thao tác</option>
                    {initialActions.map((action) => (
                      <option key={action} value={action}>
                        {formatActionLabel(action)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Từ ngày
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    defaultValue={currentStartDate}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Đến ngày
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    defaultValue={currentEndDate}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Hiển thị mỗi trang
                  </label>
                  <select
                    name="pageSize"
                    defaultValue={currentPageSize}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size} mục
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
                >
                  Áp dụng bộ lọc
                </button>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800"
                >
                  Xóa bộ lọc
                </button>
              </div>
            </form>
          ) : null}

          {hasActiveFilters ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {canViewAllLogs && currentAdmin ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  Admin: {initialAdmins.find((admin) => String(admin.id) === currentAdmin)?.username || currentAdmin}
                </span>
              ) : null}
              {currentAction ? (
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
                  Thao tác: {formatActionLabel(currentAction)}
                </span>
              ) : null}
              {currentStartDate ? (
                <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-gray-700 dark:text-gray-200">
                  Từ ngày: {currentStartDate}
                </span>
              ) : null}
              {currentEndDate ? (
                <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-gray-700 dark:text-gray-200">
                  Đến ngày: {currentEndDate}
                </span>
              ) : null}
              <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-gray-700 dark:text-gray-200">
                Hiển thị: {currentPageSize} mục
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {initialLogs.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-10 text-center dark:border-slate-700/80 dark:bg-slate-900/80">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-300">
              Không có nhật ký nào phù hợp với bộ lọc hiện tại.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm lg:block dark:border-slate-700/80 dark:bg-slate-900">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-200">
                  <tr>
                    <th className="px-5 py-4 font-black uppercase tracking-widest text-[10px]">Thời gian</th>
                    <th className="px-4 py-3 font-semibold">Người thực hiện</th>
                    <th className="px-4 py-3 font-semibold">Thao tác</th>
                    <th className="px-4 py-3 font-semibold">Đối tượng</th>
                    <th className="px-4 py-3 font-semibold">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
                  {initialLogs.map((log) => {
                    let details: Record<string, any> = {};

                    try {
                      details = JSON.parse(log.details);
                    } catch {
                      details = {};
                    }

                    return (
                      <tr key={log.id} className="transition hover:bg-amber-50/30 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-4 text-slate-500 dark:text-slate-300 text-xs whitespace-nowrap" suppressHydrationWarning>
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="px-4 py-4 font-medium text-slate-900 dark:text-white">
                          {canViewAllLogs ? log.admin.username : "Bạn"}
                        </td>
                        <td className="px-4 py-4 text-slate-700 dark:text-gray-300">
                          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            {formatActionLabel(log.action)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-600 dark:text-gray-400">
                          {formatTargetType(log.targetType)} #{log.targetId}
                        </td>
                        <td className="max-w-md px-4 py-4 text-xs text-slate-600 dark:text-gray-400">
                          {formatLogDetails(details)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 lg:hidden">
              {initialLogs.map((log) => {
                let details: Record<string, any> = {};

                try {
                  details = JSON.parse(log.details);
                } catch {
                  details = {};
                }

                return (
                  <div
                    key={log.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          {formatActionLabel(log.action)}
                        </span>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-600 tracking-tight" suppressHydrationWarning>
                          {formatDate(log.createdAt)}
                        </span>
                      </div>
                      <div className="grid gap-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-gray-900/60">
                        <p className="text-slate-700 dark:text-gray-300">
                          <span className="font-semibold text-slate-900 dark:text-white">Người thực hiện:</span>{" "}
                          {canViewAllLogs ? log.admin.username : "Bạn"}
                        </p>
                        <p className="text-slate-700 dark:text-gray-300">
                          <span className="font-semibold text-slate-900 dark:text-white">Đối tượng:</span>{" "}
                          {formatTargetType(log.targetType)} #{log.targetId}
                        </p>
                        <p className="break-words text-slate-700 dark:text-gray-300">
                          <span className="font-semibold text-slate-900 dark:text-white">Chi tiết:</span>{" "}
                          {formatLogDetails(details)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {totalPages > 1 ? (
          <div className="mt-6">
            <Pagination currentPage={initialPage} totalPages={totalPages} baseUrl="/admin/logs" />
          </div>
        ) : null}
      </div>
    </section>
  );
}
