import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { UserOrdersView } from "@/components/dashboard/user-orders-view";

export default async function OrdersPage() {
  const user = await requireUser();
  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return <UserOrdersView orders={orders} />;
}
