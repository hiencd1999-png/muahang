"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/components/shared/toast";

interface VoucherConfigItem {
  code: string;
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

  const handleUnitPriceChange = (code: string, nextValue: string) => {
    const numericValue = Math.max(0, Number(nextValue) || 0);
    setConfigs((current) =>
      current.map((config) =>
        config.code === code ? { ...config, unitPrice: numericValue } : config
      )
    );
  };

  const handleMaintenanceChange = (code: string, checked: boolean) => {
    setConfigs((current) =>
      current.map((config) =>
        config.code === code ? { ...config, isMaintenance: checked } : config
      )
    );
  };

  const handleCodeChange = (currentCode: string, nextCode: string) => {
    const normalized = nextCode.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    setConfigs((current) =>
      current.map((config) =>
        config.code === currentCode ? { ...config, code: normalized } : config
      )
    );
  };

  const handleLabelChange = (code: string, nextLabel: string) => {
    setConfigs((current) =>
      current.map((config) =>
        config.code === code ? { ...config, label: nextLabel } : config
      )
    );
  };

  const handleAddConfig = () => {
    const uniqueSuffix = Date.now().toString().slice(-6);
    setConfigs((current) => [
      ...current,
      {
        code: `NEW_${uniqueSuffix}`,
        label: "Mã mới",
        unitPrice: 0,
        isMaintenance: false,
      },
    ]);
  };

  const handleRemoveConfig = (code: string) => {
    if (configs.length <= 1) {
      addToast("error", "Phải giữ lại ít nhất 1 cấu hình voucher.");
      return;
    }

    const target = configs.find((config) => config.code === code);
    const label = target?.label || code;
    const confirmed = window.confirm(`Bạn có chắc muốn xóa cấu hình voucher \"${label}\"?`);
    if (!confirmed) {
      return;
    }

    setConfigs((current) => current.filter((config) => config.code !== code));
  };

  const handleSave = () => {
    const normalizedCodes = configs.map((config) => config.code.trim().toUpperCase());
    const hasDuplicateCode = new Set(normalizedCodes).size !== normalizedCodes.length;
    if (hasDuplicateCode) {
      addToast("error", "Mã voucher bị trùng. Vui lòng chỉnh lại trước khi lưu.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/voucher-pricing", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            configs: configs.map((config) => ({
              code: config.code,
              label: config.label,
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
            Cập nhật mã hiển thị, tên hiển thị, đơn giá và trạng thái bảo trì. Có thể thêm voucher mới trực tiếp tại đây.
          </p>
          <button
            type="button"
            onClick={handleAddConfig}
            className="mt-4 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            + Thêm cấu hình voucher
          </button>
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
          <article key={config.code} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Loại voucher</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">{config.label}</h3>
                <p className="mt-1 text-xs text-slate-500">Mã: {config.code}</p>
                <p className="mt-2 text-sm text-slate-500">Mức đang áp dụng: {formatCurrency(config.unitPrice)} / sản phẩm</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${config.isMaintenance ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                {config.isMaintenance ? "Bảo trì" : "Hoạt động"}
              </span>
            </div>

            <div className="mt-5 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  <span>Mã voucher</span>
                  <input
                    type="text"
                    value={config.code}
                    onChange={(event) => handleCodeChange(config.code, event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm uppercase outline-none transition focus:border-amber-500"
                  />
                </label>

                <label className="space-y-2 text-sm font-medium text-slate-700">
                  <span>Tên hiển thị</span>
                  <input
                    type="text"
                    value={config.label}
                    onChange={(event) => handleLabelChange(config.code, event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-amber-500"
                  />
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleRemoveConfig(config.code)}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  Xóa cấu hình
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>Giá đơn / sản phẩm (VND)</span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={config.unitPrice}
                  onChange={(event) => handleUnitPriceChange(config.code, event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-amber-500"
                />
              </label>

              <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={config.isMaintenance}
                  onChange={(event) => handleMaintenanceChange(config.code, event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Đang bảo trì
              </label>
              </div>
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