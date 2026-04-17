import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

import { UserOrdersView } from "@/components/dashboard/user-orders-view";
import { redirect } from "next/navigation";

export default async function OrdersPage(props: { searchParams: Promise<{ page?: string; pageSize?: string; q?: string; status?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser();
  const page = Math.max(1, parseInt(searchParams.page || "1"));
  const pageSize = [10, 20, 50].includes(Number(searchParams.pageSize)) ? Number(searchParams.pageSize) : 10;
  
  const query = searchParams.q || "";
  const status = searchParams.status || "";

  const whereClause: any = { userId: user.id };
  let statusCondition: any = null;
  if (status) {
    if (status === "DELIVERING_SOON") {
      statusCondition = {
        OR: [
          { shopeeTrackingData: { contains: "chuẩn bị giao" } },
          { shopeeTrackingData: { contains: "sớm được giao" } },
        ]
      };
    } else {
      whereClause.status = status;
    }
  }

  let queryCondition: any = null;
  if (query) {
    const qConds: any[] = [
      { productName: { contains: query, mode: "insensitive" } },
      { productLink: { contains: query, mode: "insensitive" } },
      { address: { contains: query, mode: "insensitive" } },
    ];
    if (/^\d+$/.test(query)) {
      qConds.push({ id: parseInt(query, 10) });
    }
    queryCondition = { OR: qConds };
  }

  if (statusCondition && queryCondition) {
    whereClause.AND = [statusCondition, queryCondition];
  } else if (statusCondition) {
    whereClause.OR = statusCondition.OR;
  } else if (queryCondition) {
    whereClause.OR = queryCondition.OR;
  }

  const [orders, totalCount, totalSystemCount] = await Promise.all([
    prisma.order.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where: whereClause }),
    prisma.order.count({ where: { userId: user.id } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  if (page > totalPages && totalPages > 0) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (status) params.set("status", status);
    params.set("pageSize", pageSize.toString());
    params.set("page", "1");
    redirect(`/dashboard/orders?${params.toString()}`);
  }

  return <UserOrdersView orders={orders} page={page} totalPages={totalPages} pageSize={pageSize} totalCount={totalCount} totalSystemCount={totalSystemCount} />;
}
