export const DEFAULT_VOUCHER_PRICING = [
  { code: "MA_80K", label: "Mã 80k", unitPrice: 80_000 },
  { code: "MA_100K", label: "Mã 100k", unitPrice: 100_000 },
  { code: "MA_50_100K", label: "Mã 50%/100k", unitPrice: 100_000 },
  { code: "MA_50_200K", label: "Mã 50%/200k", unitPrice: 200_000 },
  { code: "MA_60K", label: "Mã 60k", unitPrice: 60_000 },
] as const;

const LEGACY_VOUCHER_LABELS: Record<string, string> = {
  DISCOUNT_80K: "Mã 80k",
  DISCOUNT_100K: "Mã 100k",
  DISCOUNT_50_PERCENT_MAX_100K: "Mã 50%/100k",
  DISCOUNT_50_PERCENT_MAX_200K: "Mã 50%/200k",
  DISCOUNT_60K: "Mã 60k",
};

export const LEGACY_VOUCHER_CODES = Object.keys(LEGACY_VOUCHER_LABELS);

export interface VoucherOption {
  code: string;
  label: string;
  unitPrice: number;
  isMaintenance: boolean;
}

export function getVoucherLabel(voucherCodeOrType: string | null | undefined) {
  if (!voucherCodeOrType) {
    return "Chưa chọn voucher";
  }

  const matchedDefault = DEFAULT_VOUCHER_PRICING.find((item) => item.code === voucherCodeOrType);
  if (matchedDefault) {
    return matchedDefault.label;
  }

  return LEGACY_VOUCHER_LABELS[voucherCodeOrType] || voucherCodeOrType;
}

export function calculateVoucherOrderTotal(unitPrice: number, quantity: number) {
  return Math.max(1, quantity) * Math.max(0, unitPrice);
}
