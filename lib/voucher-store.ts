import { prisma } from "@/lib/prisma";
import {
  DEFAULT_VOUCHER_PRICING,
  getVoucherLabel,
  VOUCHER_TYPE_ORDER,
  type VoucherOption,
} from "@/lib/voucher";

export async function ensureVoucherPricingConfigs() {
  await Promise.all(
    VOUCHER_TYPE_ORDER.map((voucherType) =>
      prisma.voucherPricing.upsert({
        where: { voucherType },
        update: {},
        create: {
          voucherType,
          unitPrice: DEFAULT_VOUCHER_PRICING[voucherType],
          isMaintenance: false,
        },
      })
    )
  );

  const configs = await prisma.voucherPricing.findMany();
  const configMap = new Map(configs.map((config) => [config.voucherType, config]));

  return VOUCHER_TYPE_ORDER.map((voucherType) => {
    const config = configMap.get(voucherType);

    return {
      voucherType,
      label: getVoucherLabel(voucherType),
      unitPrice: config?.unitPrice ?? DEFAULT_VOUCHER_PRICING[voucherType],
      isMaintenance: config?.isMaintenance ?? false,
    } satisfies VoucherOption;
  });
}