import { prisma } from "@/lib/prisma";
import {
  DEFAULT_VOUCHER_PRICING,
  LEGACY_VOUCHER_CODES,
  type VoucherOption,
} from "@/lib/voucher";

export async function ensureVoucherPricingConfigs() {
  await prisma.voucherPricing.deleteMany({
    where: {
      code: {
        in: LEGACY_VOUCHER_CODES,
      },
    },
  });

  await Promise.all(
    DEFAULT_VOUCHER_PRICING.map((voucher) =>
      prisma.voucherPricing.upsert({
        where: { code: voucher.code },
        update: {
          label: voucher.label,
          unitPrice: voucher.unitPrice,
        },
        create: {
          code: voucher.code,
          label: voucher.label,
          unitPrice: voucher.unitPrice,
          isMaintenance: false,
        },
      })
    )
  );

  const configs = await prisma.voucherPricing.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  return configs.map(
    (config) =>
      ({
        code: config.code,
        label: config.label,
        unitPrice: config.unitPrice,
        isMaintenance: config.isMaintenance,
      }) satisfies VoucherOption
  );
}