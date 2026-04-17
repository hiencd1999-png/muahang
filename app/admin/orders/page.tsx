import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { StatusPill } from "@/components/shared/status-pill";
import { OrderActions } from "@/components/admin/order-actions";
import { Pagination } from "@/components/shared/pagination";
import { AdminOrdersView } from "@/components/admin/orders-view";
import { isSpAdminRole } from "@/lib/roles";
import { releaseExpiredProcessingOrders } from "@/lib/order-assignment";


const DEFAULT_PAGE_SIZE = 10;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; pageSize?: string; voucherCode?: string; dateFrom?: string; dateTo?: string }>;
}) {
  const currentAdmin = await requireUser("ADMIN");
  const canManageAllOrders = isSpAdminRole(currentAdmin.role);

  await releaseExpiredProcessingOrders();


  const params = await searchParams;
  const query = params.q || "";
  const statusFilter = params.status || "";
  const page = Math.max(1, parseInt(params.page || "1"));
  const pageSize = [10, 20, 50].includes(Number(params.pageSize)) ? Number(params.pageSize) : DEFAULT_PAGE_SIZE;
  const voucherCodeFilter = params.voucherCode || "";
  const dateFrom = params.dateFrom || "";
  const dateTo = params.dateTo || "";

  const visibilityWhere = canManageAllOrders
    ? {}
    : {
        OR: [
          { 
            status: "PENDING" as const,
            approvedByAdminId: null 
          },
          { approvedByAdminId: currentAdmin.id },
        ],
      };

  const queryWhere = query
    ? {
        OR: [
          { user: { fullName: { contains: query, mode: "insensitive" as const } } },
          { user: { username: { contains: query, mode: "insensitive" as const } } },
          { productLink: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const statusWhere = statusFilter === "DELIVERING_SOON"
    ? {
        OR: [
          { shopeeTrackingData: { contains: "chuẩn bị giao" } },
          { shopeeTrackingData: { contains: "sớm được giao" } },
        ]
      }
    : (statusFilter ? { status: statusFilter as any } : undefined);

  const [orders, totalCount] = await Promise.all([
    prisma.order.findMany({
      where: {
        AND: [
          visibilityWhere,
          ...(queryWhere ? [queryWhere] : []),
          ...(statusWhere ? [statusWhere] : [])
        ],
        ...(voucherCodeFilter && { voucherCode: { contains: voucherCodeFilter, mode: "insensitive" as const } }),
        ...((dateFrom || dateTo) && {
          createdAt: {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo && { lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999)) }),
          }
        })
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({
      where: {
        AND: [
          visibilityWhere,
          ...(queryWhere ? [queryWhere] : []),
          ...(statusWhere ? [statusWhere] : [])
        ],
        ...(voucherCodeFilter && { voucherCode: { contains: voucherCodeFilter, mode: "insensitive" as const } }),
        ...((dateFrom || dateTo) && {
          createdAt: {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo && { lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999)) }),
          }
        })
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

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

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
      pageSize={pageSize}
      currentAdminId={currentAdmin.id}
      canManageAllOrders={canManageAllOrders}
      assignableAdmins={assignableAdmins}
    />
  );
}
