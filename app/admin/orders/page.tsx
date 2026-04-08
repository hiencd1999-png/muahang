import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { StatusPill } from "@/components/shared/status-pill";
import { OrderActions } from "@/components/admin/order-actions";
import { Pagination } from "@/components/shared/pagination";
import { AdminOrdersView } from "@/components/admin/orders-view";
import { isSpAdminRole } from "@/lib/roles";
import { releaseExpiredProcessingOrders } from "@/lib/order-assignment";

const ITEMS_PER_PAGE = 20;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const currentAdmin = await requireUser("ADMIN");
  const canManageAllOrders = isSpAdminRole(currentAdmin.role);

  await releaseExpiredProcessingOrders();

  const params = await searchParams;
  const query = params.q || "";
  const statusFilter = params.status || "";
  const page = Math.max(1, parseInt(params.page || "1"));

  const visibilityWhere = canManageAllOrders
    ? {}
    : {
        OR: [
          { status: "PENDING" as const },
          { approvedByAdminId: currentAdmin.id },
        ],
      };

  const queryWhere = query
    ? {
        OR: [
          { user: { fullName: { contains: query } } },
          { user: { username: { contains: query } } },
          { productLink: { contains: query } },
        ],
      }
    : undefined;

  const [orders, totalCount] = await Promise.all([
    prisma.order.findMany({
      where: {
        AND: [visibilityWhere, ...(queryWhere ? [queryWhere] : [])],
        ...(statusFilter && { status: statusFilter as any }),
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE,
    }),
    prisma.order.count({
      where: {
        AND: [visibilityWhere, ...(queryWhere ? [queryWhere] : [])],
        ...(statusFilter && { status: statusFilter as any }),
      },
    }),
  ]);

  const approvedAdminIds = Array.from(
    new Set(
      orders
        .map((order) => order.approvedByAdminId)
        .filter((value): value is number => typeof value === "number")
    )
  );

  const responsibleAdmins = approvedAdminIds.length
    ? await prisma.user.findMany({
        where: { id: { in: approvedAdminIds } },
        select: { id: true, username: true },
      })
    : [];

  const responsibleAdminMap = new Map(
    responsibleAdmins.map((admin) => [admin.id, admin.username])
  );

  const enrichedOrders = orders.map((order) => ({
    ...order,
    approvedByAdminName: order.approvedByAdminId
      ? responsibleAdminMap.get(order.approvedByAdminId) || null
      : null,
  }));

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const assignableAdminsRaw = await prisma.user.findMany({
    where: {
      role: { in: ["ADMIN", "SPADMIN"] },
    },
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
    },
    orderBy: { username: "asc" },
  });

  const assignableAdmins = assignableAdminsRaw.map((admin) => ({
    ...admin,
    role: admin.role as "ADMIN" | "SPADMIN",
  }));

  return (
    <AdminOrdersView
      orders={enrichedOrders}
      totalCount={totalCount}
      totalPages={totalPages}
      page={page}
      currentAdminId={currentAdmin.id}
      canManageAllOrders={canManageAllOrders}
      assignableAdmins={assignableAdmins}
    />
  );
}
