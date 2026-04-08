"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDate } from "@/lib/format";
import { Pagination } from "@/components/shared/pagination";
import { useToast } from "@/components/shared/toast";

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
  initialActions: string[];
  initialAdmins: Array<{ id: number; username: string }>;
}

export function AdminLogsView({
  initialLogs,
  initialTotal,
  initialPage,
  initialActions,
  initialAdmins,
}: LogsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const [logs, setLogs] = useState(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const currentAdmin = searchParams.get("adminId") || "";
  const currentAction = searchParams.get("action") || "";
  const currentStartDate = searchParams.get("startDate") || "";
  const currentEndDate = searchParams.get("endDate") || "";

  const handleFilterChange = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const params = new URLSearchParams();
    const adminId = formData.get("adminId");
    const action = formData.get("action");
    const startDate = formData.get("startDate");
    const endDate = formData.get("endDate");

    if (adminId) params.set("adminId", adminId as string);
    if (action) params.set("action", action as string);
    if (startDate) params.set("startDate", startDate as string);
    if (endDate) params.set("endDate", endDate as string);

    params.set("page", "1");

    router.push(`/admin/logs?${params.toString()}`);
  };

  const handleClearFilters = () => {
    router.push("/admin/logs");
    setShowFilters(false);
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <section className="panel rounded-[1.75rem] p-4 sm:p-6 bg-white dark:bg-gray-900 border dark:border-gray-800">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
              Nhật ký hoạt động hệ thống
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">
              Ghi lại các thao tác quan trọng của user và admin
            </p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="rounded-lg px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white transition-colors text-sm font-medium"
          >
            {showFilters ? "Ẩn bộ lọc" : "Hiển thị bộ lọc"}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <form
            onSubmit={handleFilterChange}
            className="mt-4 rounded-lg bg-gray-50 dark:bg-gray-800 p-4 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                  Admin
                </label>
                <select
                  name="adminId"
                  defaultValue={currentAdmin}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">-- Tất cả --</option>
                  {initialAdmins.map((admin) => (
                    <option key={admin.id} value={admin.id}>
                      {admin.username}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                  Thao tác
                </label>
                <select
                  name="action"
                  defaultValue={currentAction}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">-- Tất cả --</option>
                  {initialActions.map((action) => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                  Từ ngày
                </label>
                <input
                  type="date"
                  name="startDate"
                  defaultValue={currentStartDate}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                  Đến ngày
                </label>
                <input
                  type="date"
                  name="endDate"
                  defaultValue={currentEndDate}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 sm:flex-none rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-white text-sm font-semibold transition-colors"
              >
                Tìm kiếm
              </button>
              <button
                type="button"
                onClick={handleClearFilters}
                className="flex-1 sm:flex-none rounded-lg bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 px-4 py-2 text-gray-900 dark:text-white text-sm font-semibold transition-colors"
              >
                Xóa bộ lọc
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="mt-5 space-y-3">
        {logs.length === 0 ? (
          <div className="rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 p-8 text-center">
            <p className="text-sm text-slate-600 dark:text-gray-400">
              Chưa có hoạt động nào được ghi nhận
            </p>
          </div>
        ) : (
          <>
            {/* Desktop View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-slate-500 dark:text-gray-400">
                  <tr className="border-b border-slate-200 dark:border-gray-700">
                    <th className="pb-3 px-4 font-semibold">Thời gian</th>
                    <th className="pb-3 px-4 font-semibold">Người thực hiện</th>
                    <th className="pb-3 px-4 font-semibold">Thao tác</th>
                    <th className="pb-3 px-4 font-semibold">Loại mục tiêu</th>
                    <th className="pb-3 px-4 font-semibold">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
                  {logs.map((log) => {
                    let details: Record<string, any> = {};
                    try {
                      details = JSON.parse(log.details);
                    } catch (e) {
                      details = {};
                    }

                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-amber-50/30 dark:hover:bg-gray-800/50 transition"
                      >
                        <td className="py-4 px-4 text-slate-600 dark:text-gray-300">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="py-4 px-4 font-medium text-slate-900 dark:text-white">
                          {log.admin.username}
                        </td>
                        <td className="py-4 px-4 text-slate-700 dark:text-gray-300">
                          <span className="rounded-md bg-blue-100 dark:bg-blue-900 px-2 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-slate-600 dark:text-gray-400">
                          {log.targetType}
                        </td>
                        <td className="py-4 px-4 text-slate-600 dark:text-gray-400 text-xs max-w-xs truncate">
                          {details.count
                            ? `${details.count} items`
                            : details.notes
                            ? details.notes
                            : "---"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="lg:hidden space-y-3">
              {logs.map((log) => {
                let details: Record<string, any> = {};
                try {
                  details = JSON.parse(log.details);
                } catch (e) {
                  details = {};
                }

                return (
                  <div
                    key={log.id}
                    className="rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-blue-100 dark:bg-blue-900 px-2 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                            {log.action}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-600 dark:text-gray-400">
                          {log.admin.username}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-gray-500">
                          {formatDate(log.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6">
            <Pagination currentPage={initialPage} totalPages={totalPages} baseUrl="/admin/logs" />
          </div>
        )}
      </div>
    </section>
  );
}
