import { VoucherPricingManager } from "@/components/admin/voucher-pricing-manager";
import { requireUser } from "@/lib/session";
import { ensureVoucherPricingConfigs } from "@/lib/voucher-store";
import { prisma } from "@/lib/prisma";

export default async function AdminVoucherPricingPage() {
  const user = await requireUser("ADMIN");
  const isSpAdmin = user.role === "SPADMIN";
  let configs = await ensureVoucherPricingConfigs();

  if (!isSpAdmin) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { disabledVouchers: true },
    });
    const disabledVouchers = dbUser?.disabledVouchers || [];
    
    configs = configs.map(c => ({
      ...c,
      isMaintenance: c.isMaintenance || disabledVouchers.includes(c.code),
    }));
  }

  return <VoucherPricingManager initialConfigs={configs} isSpAdmin={isSpAdmin} />;
}