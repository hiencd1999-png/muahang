"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/shared/toast";

type ProxyItem = {
  id: number;
  host: string;
  port: number;
  username: string;
  passwordMasked: string;
  isActive: boolean;
  createdAt: string;
};

const PAGE_SIZE_OPTIONS = [20, 50, 100, 500] as const;

function isValidProxyLine(line: string) {
  const parts = line.split(":");
  if (parts.length !== 4) {
    return false;
  }

  const host = parts[0]?.trim();
  const port = Number(parts[1]?.trim());
  const username = parts[2]?.trim();
  const password = parts[3]?.trim();

  return Boolean(host && Number.isInteger(port) && port >= 1 && port <= 65535 && username && password);
}

export function SystemProxyManager({ initialProxies }: { initialProxies: ProxyItem[] }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const [proxies, setProxies] = useState<ProxyItem[]>(initialProxies);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(20);
  const [currentPage, setCurrentPage] = useState(1);

  const previewStats = useMemo(() => {
    const rows = bulkInput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    let valid = 0;
    for (const row of rows) {
      if (isValidProxyLine(row)) {
        valid += 1;
      }
    }

    return {
      total: rows.length,
      valid,
      invalid: rows.length - valid,
    };
  }, [bulkInput]);

  const filteredProxies = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return proxies;
    }

    return proxies.filter((proxy) => {
      const searchable = [proxy.host, String(proxy.port), proxy.username].join(" ").toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [proxies, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredProxies.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedProxies = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredProxies.slice(startIndex, startIndex + pageSize);
  }, [filteredProxies, pageSize, safeCurrentPage]);

  const selectedVisibleCount = paginatedProxies.filter((proxy) => selectedIds.includes(proxy.id)).length;
  const allVisibleSelected = paginatedProxies.length > 0 && selectedVisibleCount === paginatedProxies.length;

  const refreshList = async () => {
    const response = await fetch("/api/admin/proxies", { method: "GET", cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Không thể tải danh sách proxy.");
    }

    setProxies(data.proxies);
    setSelectedIds([]);
  };

  const handleImport = () => {
    if (!bulkInput.trim()) {
      addToast("error", "Vui lòng nhập danh sách proxy.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/proxies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proxiesText: bulkInput }),
        });

        const data = await response.json();
        if (!response.ok) {
          addToast("error", data.error || "Import proxy thất bại.");
          return;
        }

        await refreshList();
        router.refresh();

        const invalidCount = Array.isArray(data.invalidRows) ? data.invalidRows.length : 0;
        const duplicateInInputCount = Number(data.duplicateInInputCount || 0);
        const duplicateInSystemCount = Number(data.duplicateInSystemCount || 0);
        addToast(
          "success",
          `Import xong: thêm mới ${data.createdCount}, trùng trong danh sách ${duplicateInInputCount}, trùng hệ thống ${duplicateInSystemCount}, lỗi ${invalidCount}.`
        );

        setBulkInput("");
        setCurrentPage(1);
      } catch (error) {
        addToast("error", error instanceof Error ? error.message : "Có lỗi khi import proxy.");
      }
    });
  };

  const handleDelete = async (ids: number[]) => {
    if (ids.length === 0) {
      return;
    }

    const isBatchDelete = ids.length > 1;
    const target = !isBatchDelete ? proxies.find((item) => item.id === ids[0]) : null;
    const title = target ? `${target.host}:${target.port}` : `${ids.length} proxy`;

    if (!window.confirm(`Xóa ${title}?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch("/api/admin/proxies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      const data = await response.json();
      if (!response.ok) {
        addToast("error", data.error || "Không thể xóa proxy.");
        return;
      }

      setProxies((current) => current.filter((item) => !ids.includes(item.id)));
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      router.refresh();
      addToast("success", isBatchDelete ? `Đã xóa ${ids.length} proxy khỏi hệ thống.` : "Đã xóa proxy khỏi hệ thống.");
    } catch {
      addToast("error", "Có lỗi khi xóa proxy.");
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelectAllVisible = (checked: boolean) => {
    if (checked) {
      setSelectedIds((current) => Array.from(new Set([...current, ...paginatedProxies.map((proxy) => proxy.id)])));
      return;
    }

    const visibleIds = new Set(paginatedProxies.map((proxy) => proxy.id));
    setSelectedIds((current) => current.filter((id) => !visibleIds.has(id)));
  };

  const toggleSelectRow = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds((current) => Array.from(new Set([...current, id])));
      return;
    }

    setSelectedIds((current) => current.filter((item) => item !== id));
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (value: string) => {
    const nextPageSize = Number(value) as (typeof PAGE_SIZE_OPTIONS)[number];
    setPageSize(nextPageSize);
    setCurrentPage(1);
  };

  return (
    <section className="space-y-6">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">SPADMIN</p>
        <h2 className="mt-3 text-2xl font-semibold text-slate-950">Quản lý proxy hệ thống</h2>
        <p className="mt-2 text-sm text-slate-600">
          Nhập hàng loạt proxy theo định dạng ip:port:user:pass. Dữ liệu được lưu DB để dùng cho các chức năng sau.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Hệ thống sẽ tự bỏ qua proxy bị trùng trong danh sách nhập và proxy đã tồn tại trong database.
        </p>

        <div className="mt-5 space-y-3">
          <textarea
            value={bulkInput}
            onChange={(event) => setBulkInput(event.target.value)}
            rows={8}
            placeholder={"103.1.2.3:8080:user1:pass1\n103.1.2.4:8080:user2:pass2"}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm outline-none transition focus:border-amber-500"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <p>
              Tổng dòng: {previewStats.total} | Hợp lệ: {previewStats.valid} | Lỗi định dạng: {previewStats.invalid}
            </p>
            <button
              type="button"
              onClick={handleImport}
              disabled={isPending}
              className="rounded-2xl bg-amber-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 shadow-lg shadow-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Đang import..." : "Import danh sách proxy"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-950">Danh sách proxy đã lưu</h3>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {proxies.length} proxy
          </span>
        </div>

        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Tìm theo host, port hoặc username"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-amber-500"
            />
            <select
              value={pageSize}
              onChange={(event) => handlePageSizeChange(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-amber-500"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} / trang
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Đã chọn {selectedIds.length}</span>
            <button
              type="button"
              disabled={isDeleting || selectedIds.length === 0}
              onClick={() => void handleDelete(selectedIds)}
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Xóa đã chọn
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(event) => toggleSelectAllVisible(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                    aria-label="Chọn tất cả proxy đang hiển thị"
                  />
                </th>
                <th className="px-3 py-2">Host</th>
                <th className="px-3 py-2">Port</th>
                <th className="px-3 py-2">Username</th>
                <th className="px-3 py-2">Password</th>
                <th className="px-3 py-2">Ngày thêm</th>
                <th className="px-3 py-2">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProxies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                    {proxies.length === 0 ? "Chưa có proxy nào trong hệ thống." : "Không có proxy phù hợp với bộ lọc hiện tại."}
                  </td>
                </tr>
              ) : (
                paginatedProxies.map((proxy) => (
                  <tr key={proxy.id} className="border-b border-slate-100">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(proxy.id)}
                        onChange={(event) => toggleSelectRow(proxy.id, event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300"
                        aria-label={`Chọn proxy ${proxy.host}:${proxy.port}`}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono">{proxy.host}</td>
                    <td className="px-3 py-2">{proxy.port}</td>
                    <td className="px-3 py-2 font-mono">{proxy.username}</td>
                    <td className="px-3 py-2 font-mono">{proxy.passwordMasked}</td>
                    <td className="px-3 py-2">{new Date(proxy.createdAt).toLocaleString("vi-VN")}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => void handleDelete([proxy.id])}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Hiển thị {paginatedProxies.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1}
            -
            {Math.min(safeCurrentPage * pageSize, filteredProxies.length)} / {filteredProxies.length} proxy
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={safeCurrentPage <= 1}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Trước
            </button>
            <span className="min-w-24 text-center text-xs font-semibold text-slate-500">
              Trang {safeCurrentPage}/{totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Sau
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
