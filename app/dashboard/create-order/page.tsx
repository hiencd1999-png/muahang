import { requireUser } from "@/lib/session";
import { CreateOrderForm } from "@/components/dashboard/create-order-form";
import { ensureVoucherPricingConfigs } from "@/lib/voucher-store";

export default async function CreateOrderPage() {
  const user = await requireUser();
  const voucherConfigs = await ensureVoucherPricingConfigs();

  return <CreateOrderForm balance={user.balance} voucherConfigs={voucherConfigs} />;
}
