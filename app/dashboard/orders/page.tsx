import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

import { UserOrdersView } from "@/components/dashboard/user-orders-view";
import { redirect } from "next/navigation";

export default async function OrdersPage({ searchParams }: { searchParams: { page?: string; pageSize?: string } }) {
  const user = await requireUser();
  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const pageSize = [10, 20, 50].includes(Number(searchParams.pageSize)) ? Number(searchParams.pageSize) : 10;

  const [orders, totalCount] = await Promise.all([
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where: { userId: user.id } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Nếu page vượt quá totalPages, chuyển về page 1
  if (page > totalPages && totalPages > 0) {
    redirect(`/dashboard/orders?page=1&pageSize=${pageSize}`);
  }

  return <UserOrdersView orders={orders} page={page} totalPages={totalPages} pageSize={pageSize} totalCount={totalCount} />;
}
