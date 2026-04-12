import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { requireUser } from "@/lib/session";

export default async function AdminPage() {
  await requireUser("ADMIN");

  const [totalUsers, totalOrders, revenue] = await Promise.all([
    prisma.user.count(),
    prisma.order.count(),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { 
        status: "DELIVERED",
        complaintStatus: { not: "APPROVED" }
      },
    }),
  ]);

  return (
    <section className="grid gap-4 md:grid-cols-3">
      <article className="panel rounded-[1.75rem] p-6">
        <p className="text-sm text-slate-500 dark:text-slate-400">Tổng user</p>
        <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{totalUsers}</p>
      </article>
      <article className="panel rounded-[1.75rem] p-6">
        <p className="text-sm text-slate-500 dark:text-slate-400">Tổng đơn</p>
        <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{totalOrders}</p>
      </article>
      <article className="panel rounded-[1.75rem] p-6">
        <p className="text-sm text-slate-500 dark:text-slate-400">Doanh thu</p>
        <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{formatCurrency(revenue._sum.total ?? 0)}</p>
      </article>
    </section>
  );
}
