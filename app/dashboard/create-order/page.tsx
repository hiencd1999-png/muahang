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

  const safeAdmins = rawAdmins.map(a => ({
    id: a.id,
    displayName: a.fullName ? a.fullName : `Chuyên viên số ${a.id}`
  }));

  return <CreateOrderForm balance={user.balance} voucherConfigs={voucherConfigs} admins={safeAdmins} />;
}
