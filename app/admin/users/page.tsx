import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { AdminUsersView } from "@/components/admin/users-view";
import { isSpAdminRole } from "@/lib/roles";

const ITEMS_PER_PAGE = 20;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; sort?: string }>;
}) {
  const currentAdmin = await requireUser("ADMIN");
  const operatorIsSpAdmin = isSpAdminRole(currentAdmin.role);

  const params = await searchParams;
  const query = params.q || "";
  const page = Math.max(1, parseInt(params.page || "1"));
  const sort = params.sort || "";

  const queryIsNumeric = query.length > 0 && /^\d+$/.test(query);

  const baseWhereClause = operatorIsSpAdmin
    ? {}
    : {
        OR: [
          { role: "USER" as const },
          { id: currentAdmin.id },
        ],
      };

  const queryWhereClause = query
    ? {
        OR: [
          ...(queryIsNumeric ? [{ id: parseInt(query, 10) }] : []),
          { fullName: { contains: query, mode: "insensitive" as const } },
          { username: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : null;

  const whereClause = queryWhereClause
    ? { AND: [baseWhereClause, queryWhereClause] }
    : baseWhereClause;

  const orderBy =
    sort === "balance_asc"
      ? { balance: "asc" }
      : sort === "balance_desc"
      ? { balance: "desc" }
      : { createdAt: "desc" };

  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      orderBy,
      skip: (page - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE,
    }),
    prisma.user.count({
      where: whereClause,
    }),
  ]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <AdminUsersView
      users={users}
      totalCount={totalCount}
      totalPages={totalPages}
      page={page}
      currentAdminId={currentAdmin.id}
      operatorIsSpAdmin={operatorIsSpAdmin}
      query={query}
      sort={sort}
    />
  );
}
