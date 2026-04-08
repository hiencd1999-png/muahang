import { VoucherPricingManager } from "@/components/admin/voucher-pricing-manager";
import { requireUser } from "@/lib/session";
import { ensureVoucherPricingConfigs } from "@/lib/voucher-store";

export default async function AdminVoucherPricingPage() {
  await requireUser("SPADMIN");
  const configs = await ensureVoucherPricingConfigs();

  return <VoucherPricingManager initialConfigs={configs} />;
}