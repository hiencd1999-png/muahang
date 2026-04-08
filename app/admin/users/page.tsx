import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { UserManagementControls } from "@/components/admin/user-balance-controls";
import { Pagination } from "@/components/shared/pagination";
import { isSpAdminRole } from "@/lib/roles";

const ITEMS_PER_PAGE = 20;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const currentAdmin = await requireUser("ADMIN");
  const canManageRoles = isSpAdminRole(currentAdmin.role);

  const params = await searchParams;
  const query = params.q || "";
  const page = Math.max(1, parseInt(params.page || "1"));

  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      where: query
        ? {
            OR: [
              { fullName: { contains: query } },
              { username: { contains: query } },
            ],
          }
        : {},
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE,
    }),
    prisma.user.count({
      where: query
        ? {
            OR: [
              { fullName: { contains: query } },
              { username: { contains: query } },
            ],
          }
        : {},
    }),
  ]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <section className="panel rounded-[1.75rem] p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-slate-950">Quản lý user</h2>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={query}
            placeholder="Tìm tên hoặc username..."
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 sm:w-64"
          />
          <button
            type="submit"
            className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Tìm
          </button>
        </form>
      </div>

      <div className="mt-5">
        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto w-full">
          <table className="min-w-[1000px] w-full text-left text-sm border-collapse">
            <thead className="bg-slate-100 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">ID</th>
                <th className="px-4 py-3 font-semibold">Người dùng</th>
                <th className="px-4 py-3 font-semibold text-center">Role</th>
                <th className="px-4 py-3 font-semibold">Số dư</th>
                <th className="px-4 py-3 font-semibold text-center">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-slate-200 transition hover:bg-slate-50">
                  <td className="px-4 py-4 font-medium text-slate-900">#{user.id}</td>
                  <td className="px-4 py-4 text-slate-700">
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-900">{user.fullName || user.username}</p>
                      <p className="text-xs text-slate-500 font-mono">@{user.username}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-center">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                        user.role === 'SPADMIN' ? 'bg-amber-100 text-amber-800' : 
                        user.role === 'ADMIN' ? 'bg-blue-100 text-blue-800' : 
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {user.role}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-950 font-bold">{formatCurrency(user.balance)}</td>
                  <td className="px-4 py-4">
                    <div className="flex justify-center">
                      <UserManagementControls
                        userId={user.id}
                        username={user.username}
                        currentRole={user.role}
                        currentBalance={user.balance}
                        displayName={user.fullName || user.username}
                        email={user.email}
                        phone={user.phone}
                        canManageRoles={canManageRoles && (user.role !== "SPADMIN" || user.id === currentAdmin.id)}
                        canEditUser={canManageRoles ? (user.role !== "SPADMIN" || user.id === currentAdmin.id) : user.role === "USER"}
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
            <div key={user.id} className="rounded-xl border border-slate-200/70 bg-white/70 p-4">
              <div className="flex flex-col gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">ID: {user.id}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{user.role}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-900">{user.fullName || user.username}</p>
                  <p className="mt-1 text-xs text-slate-500">@{user.username}</p>
                  <p className="mt-1 text-sm text-slate-600">{formatCurrency(user.balance)}</p>
                </div>
                <div className="w-full">
                  <UserManagementControls
                    userId={user.id}
                    username={user.username}
                    currentRole={user.role}
                    currentBalance={user.balance}
                    displayName={user.fullName || user.username}
                    email={user.email}
                    phone={user.phone}
                    canManageRoles={canManageRoles && (user.role !== "SPADMIN" || user.id === currentAdmin.id)}
                    canEditUser={canManageRoles ? (user.role !== "SPADMIN" || user.id === currentAdmin.id) : user.role === "USER"}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Pagination currentPage={page} totalPages={totalPages} baseUrl="/admin/users" />
    </section>
  );
}
