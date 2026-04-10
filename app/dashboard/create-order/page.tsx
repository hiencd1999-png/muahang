import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CreateOrderForm } from "@/components/dashboard/create-order-form";
import { ensureVoucherPricingConfigs } from "@/lib/voucher-store";

export default async function CreateOrderPage() {
  const user = await requireUser();
  const voucherConfigs = await ensureVoucherPricingConfigs();
  
  const rawAdmins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SPADMIN"] } },
    select: { id: true, fullName: true },
  });

  const adminIds = rawAdmins.map(a => a.id);

  const stats = await prisma.order.groupBy({
    by: ['approvedByAdminId', 'status'],
    where: {
      approvedByAdminId: { in: adminIds },
      status: { in: ["DELIVERED", "CANCELED"] }
    },
    _count: true,
  });

  const statsMap = new Map<number, { delivered: number; canceled: number }>();
  for (const s of stats) {
    if (!s.approvedByAdminId) continue;
    if (!statsMap.has(s.approvedByAdminId)) statsMap.set(s.approvedByAdminId, { delivered: 0, canceled: 0 });
    
    const entry = statsMap.get(s.approvedByAdminId)!;
    if (s.status === "DELIVERED") entry.delivered += s._count;
    if (s.status === "CANCELED") entry.canceled += s._count;
  }

  const safeAdmins = rawAdmins.map(a => {
    const s = statsMap.get(a.id) || { delivered: 0, canceled: 0 };
    const total = s.delivered + s.canceled;
    const rate = total > 0 ? Math.round((s.delivered / total) * 100) : 0;
    
    return {
      id: a.id,
      displayName: a.fullName ? a.fullName : `Chuyên viên số ${a.id}`,
      delivered: s.delivered,
      canceled: s.canceled,
      rate: rate,
      total: total
    };
  });

  return <CreateOrderForm balance={user.balance} voucherConfigs={voucherConfigs} admins={safeAdmins} />;
}
