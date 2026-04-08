import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { StatusPill } from "@/components/shared/status-pill";
import { OrderActions } from "@/components/admin/order-actions";
import { Pagination } from "@/components/shared/pagination";
import { AdminOrdersView } from "@/components/admin/orders-view";

const ITEMS_PER_PAGE = 20;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireUser("ADMIN");

  const params = await searchParams;
  const query = params.q || "";
  const statusFilter = params.status || "";
  const page = Math.max(1, parseInt(params.page || "1"));

  const [orders, totalCount] = await Promise.all([
    prisma.order.findMany({
      where: {
        ...(query && {
          OR: [
            { user: { username: { contains: query } } },
            { productLink: { contains: query } },
          ],
        }),
        ...(statusFilter && { status: statusFilter as any }),
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE,
    }),
    prisma.order.count({
      where: {
        ...(query && {
          OR: [
            { user: { username: { contains: query } } },
            { productLink: { contains: query } },
          ],
        }),
        ...(statusFilter && { status: statusFilter as any }),
      },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <AdminOrdersView
      orders={orders}
      totalCount={totalCount}
      totalPages={totalPages}
      page={page}
    />
  );
}
