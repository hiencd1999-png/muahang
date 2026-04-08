import { VoucherType } from "@prisma/client";

export const VOUCHER_TYPE_ORDER = [
  VoucherType.DISCOUNT_80K,
  VoucherType.DISCOUNT_100K,
  VoucherType.DISCOUNT_50_PERCENT_MAX_100K,
  VoucherType.DISCOUNT_50_PERCENT_MAX_200K,
  VoucherType.DISCOUNT_60K,
] as const;

export const DEFAULT_VOUCHER_PRICING = {
  [VoucherType.DISCOUNT_80K]: 80_000,
  [VoucherType.DISCOUNT_100K]: 100_000,
  [VoucherType.DISCOUNT_50_PERCENT_MAX_100K]: 100_000,
  [VoucherType.DISCOUNT_50_PERCENT_MAX_200K]: 200_000,
  [VoucherType.DISCOUNT_60K]: 60_000,
} satisfies Record<VoucherType, number>;

export const VOUCHER_LABELS = {
  [VoucherType.DISCOUNT_80K]: "Mã giảm 80k",
  [VoucherType.DISCOUNT_100K]: "Mã giảm 100k",
  [VoucherType.DISCOUNT_50_PERCENT_MAX_100K]: "Mã giảm 50% tối đa 100k",
  [VoucherType.DISCOUNT_50_PERCENT_MAX_200K]: "Mã giảm 50% tối đa 200k",
  [VoucherType.DISCOUNT_60K]: "Mã giảm 60k",
} satisfies Record<VoucherType, string>;

export interface VoucherOption {
  voucherType: VoucherType;
  label: string;
  unitPrice: number;
  isMaintenance: boolean;
}

export function getVoucherLabel(voucherType: VoucherType | null | undefined) {
  if (!voucherType) {
    return "Chưa chọn voucher";
  }

  return VOUCHER_LABELS[voucherType];
}

export function calculateVoucherOrderTotal(unitPrice: number, quantity: number) {
  return Math.max(1, quantity) * Math.max(0, unitPrice);
}
