"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { UserManagementControls } from "./user-balance-controls";
import { Pagination } from "@/components/shared/pagination";
import { BatchActionsToolbar } from "./batch-actions-toolbar";
import { useRouter } from "next/navigation";

interface User {
  id: number;
  username: string;
  fullName: string | null;
  role: string;
  balance: number;
  email: string;
  phone: string;
  createdAt: Date;
}

export function AdminUsersView({
  users,
  totalCount,
  totalPages,
  page,
  currentAdminId,
  operatorIsSpAdmin,
  query,
}: {
  users: User[];
  totalCount: number;
  totalPages: number;
  page: number;
  currentAdminId: number;
  operatorIsSpAdmin: boolean;
  query: string;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedIds(users.map((u) => u.id));
  };

  const clearAll = () => {
    setSelectedIds([]);
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = formData.get("q") as string;
    
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("page", "1");
    
    router.push(`/admin/users?${params.toString()}`);
  };

  return (
    <section className="panel rounded-[1.75rem] p-4 sm:p-6 relative">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Quản lý user</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {totalCount} người dùng trong hệ thống
          </p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            name="q"
            defaultValue={query}
            placeholder="Tìm tên hoặc username..."
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:text-white sm:w-64"
          />
          <button
            type="submit"
            className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition"
          >
            Tìm
          </button>
        </form>
      </div>

      <div className="mt-5 pb-20">
        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto w-full">
          <table className="min-w-[1000px] w-full text-left text-sm border-collapse">
            <thead className="bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-white shadow-sm border-b-2 dark:border-zinc-700">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === users.length && users.length > 0}
                    onChange={(e) => (e.target.checked ? selectAll() : clearAll())}
                    className="rounded dark:bg-zinc-900 dark:border-zinc-500"
                  />
                </th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">ID</th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Người dùng</th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center">Role</th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Số dư</th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-slate-200 dark:border-slate-800/70 transition hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(user.id)}
                      onChange={() => toggleSelect(user.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-4 font-medium text-slate-900 dark:text-white">#{user.id}</td>
                  <td className="px-4 py-4 text-slate-700 dark:text-slate-300">
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-900 dark:text-white">{user.fullName || user.username}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">@{user.username}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-center">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                        user.role === 'SPADMIN' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400' : 
                        user.role === 'ADMIN' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400' : 
                        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {user.role}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-950 dark:text-white font-bold">{formatCurrency(user.balance)}</td>
                  <td className="px-4 py-4">
                    <div className="flex justify-center">
                      <UserManagementControls
                        userId={user.id}
                        username={user.username}
                        currentRole={user.role as any}
                        currentBalance={user.balance}
                        displayName={user.fullName || user.username}
                        email={user.email}
                        phone={user.phone}
                        canManageRoles={operatorIsSpAdmin && (user.role !== "SPADMIN" || user.id === currentAdminId)}
                        canEditUser={operatorIsSpAdmin ? (user.role !== "SPADMIN" || user.id === currentAdminId) : user.role === "USER"}
                        operatorIsSpAdmin={operatorIsSpAdmin}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-4">
          {users.map((user) => (
            <div key={user.id} className="rounded-xl border border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-900/40 p-4">
              <div className="flex flex-col gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(user.id)}
                      onChange={() => toggleSelect(user.id)}
                      className="rounded"
                    />
                    <span className="font-medium text-slate-900 dark:text-white">ID: {user.id}</span>
                    <span className="rounded-full bg-slate-100 dark:bg-slate-800/50 px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">{user.role}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{user.fullName || user.username}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">@{user.username}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 font-bold">{formatCurrency(user.balance)}</p>
                </div>
                <div className="w-full">
                  <UserManagementControls
                    userId={user.id}
                    username={user.username}
                    currentRole={user.role as any}
                    currentBalance={user.balance}
                    displayName={user.fullName || user.username}
                    email={user.email}
                    phone={user.phone}
                    canManageRoles={operatorIsSpAdmin && (user.role !== "SPADMIN" || user.id === currentAdminId)}
                    canEditUser={operatorIsSpAdmin ? (user.role !== "SPADMIN" || user.id === currentAdminId) : user.role === "USER"}
                    operatorIsSpAdmin={operatorIsSpAdmin}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BatchActionsToolbar
        selectedCount={selectedIds.length}
        totalCount={totalCount}
        onSelectAll={selectAll}
        onClearAll={clearAll}
        actionType="users"
        isSpAdmin={operatorIsSpAdmin}
        selectedIds={selectedIds}
      />

      <div className="mt-6">
        <Pagination currentPage={page} totalPages={totalPages} baseUrl="/admin/users" />
      </div>
    </section>
  );
}
