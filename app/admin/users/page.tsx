import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { UserBalanceControls } from "@/components/admin/user-balance-controls";
import { Pagination } from "@/components/shared/pagination";

const ITEMS_PER_PAGE = 20;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  await requireUser("ADMIN");

  const query = searchParams.q || "";
  const page = Math.max(1, parseInt(searchParams.page || "1"));

  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      where: query ? { username: { contains: query } } : {},
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE,
    }),
    prisma.user.count({
      where: query ? { username: { contains: query } } : {},
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
            placeholder="Tìm username..."
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
        <div className="hidden lg:block overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-3">ID</th>
                <th className="pb-3">Username</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Balance</th>
                <th className="pb-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-slate-200/70 align-top">
                  <td className="py-4 font-medium text-slate-900">{user.id}</td>
                  <td className="py-4 text-slate-700">{user.username}</td>
                  <td className="py-4 text-slate-600">{user.role}</td>
                  <td className="py-4 text-slate-700">{formatCurrency(user.balance)}</td>
                  <td className="py-4"><UserBalanceControls userId={user.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-4">
          {users.map((user) => (
            <div key={user.id} className="rounded-xl border border-slate-200/70 bg-white/70 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">ID: {user.id}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{user.role}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{user.username}</p>
                  <p className="mt-1 text-sm text-slate-600">{formatCurrency(user.balance)}</p>
                </div>
                <div className="ml-4">
                  <UserBalanceControls userId={user.id} />
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
