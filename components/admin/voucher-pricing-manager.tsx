"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { VoucherType } from "@prisma/client";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/components/shared/toast";

interface VoucherConfigItem {
  voucherType: VoucherType;
  label: string;
  unitPrice: number;
  isMaintenance: boolean;
}

export function VoucherPricingManager({ initialConfigs }: { initialConfigs: VoucherConfigItem[] }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [configs, setConfigs] = useState(initialConfigs);

  const activeCount = configs.filter((config) => !config.isMaintenance).length;

  const handleUnitPriceChange = (voucherType: VoucherType, nextValue: string) => {
    const numericValue = Math.max(0, Number(nextValue) || 0);
    setConfigs((current) =>
      current.map((config) =>
        config.voucherType === voucherType ? { ...config, unitPrice: numericValue } : config
      )
    );
  };

  const handleMaintenanceChange = (voucherType: VoucherType, checked: boolean) => {
    setConfigs((current) =>
      current.map((config) =>
        config.voucherType === voucherType ? { ...config, isMaintenance: checked } : config
      )
    );
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/voucher-pricing", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            configs: configs.map((config) => ({
              voucherType: config.voucherType,
              unitPrice: config.unitPrice,
              isMaintenance: config.isMaintenance,
            })),
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          addToast("error", data.error || "Không thể lưu cấu hình voucher.");
          return;
        }

        setConfigs(data.configs);
        addToast("success", "Đã cập nhật cấu hình voucher.");
        router.refresh();
      } catch {
        addToast("error", "Có lỗi khi lưu cấu hình voucher.");
      }
    });
  };

  return (
    <section className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">SPADMIN</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-950">Cấu hình giá đơn theo loại voucher</h2>
          <p className="mt-2 text-sm text-slate-600">
            Cập nhật đơn giá cho từng loại mã voucher và bật bảo trì để chặn user tạo đơn với loại mã đó.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5 shadow-sm">
            <p className="text-sm text-slate-500">Voucher đang mở</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{activeCount}</p>
          </div>
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Voucher bảo trì</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{configs.length - activeCount}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {configs.map((config) => (
          <article key={config.voucherType} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Loại voucher</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">{config.label}</h3>
                <p className="mt-2 text-sm text-slate-500">Mức đang áp dụng: {formatCurrency(config.unitPrice)} / sản phẩm</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${config.isMaintenance ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                {config.isMaintenance ? "Bảo trì" : "Hoạt động"}
              </span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>Giá đơn / sản phẩm (VND)</span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={config.unitPrice}
                  onChange={(event) => handleUnitPriceChange(config.voucherType, event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-amber-500"
                />
              </label>

              <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={config.isMaintenance}
                  onChange={(event) => handleMaintenanceChange(config.voucherType, event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Đang bảo trì
              </label>
            </div>
          </article>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">User chỉ tạo được đơn với các voucher đang hoạt động. Giá mới chỉ áp dụng cho các đơn tạo sau khi lưu.</p>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Đang lưu..." : "Lưu cấu hình voucher"}
        </button>
      </div>
    </section>
  );
}