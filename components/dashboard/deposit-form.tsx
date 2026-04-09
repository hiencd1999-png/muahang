"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/shared/toast";

export function DepositForm() {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const presets = [
    { label: "100k", value: 100000 },
    { label: "250k", value: 250000 },
    { label: "500k", value: 500000 },
    { label: "1M", value: 1000000 },
  ];

  const handlePreset = (amount: number) => {
    if (inputRef.current) {
      inputRef.current.value = amount.toString();
      inputRef.current.focus();
    }
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget; // Luu lai reference
    setLoading(true);

    const formData = new FormData(form);
    const amount = Number(formData.get("amount"));

    try {
      const response = await fetch("/api/user/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      const data = await response.json();

      if (!response.ok) {
        addToast("error", data.error ?? "Nạp tiền thất bại.");
        setLoading(false);
        return;
      }

      addToast("success", "Nạp tiền thành công!");
      form.reset();
      router.refresh();
    } catch (error) {
      console.error("Deposit error:", error);
      addToast("error", "Lỗi mạng hoặc server không phản hồi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel rounded-[1.75rem] p-6 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Nạp tiền vào tài khoản</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">Nhập số tiền VND để cộng trực tiếp vào balance.</p>
      </div>

      {/* Preset buttons */}
      <div className="mt-5 space-y-2">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Nạp nhanh:</p>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => handlePreset(preset.value)}
              className="rounded-xl border-2 border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 text-sm font-semibold text-amber-700 dark:text-amber-400 transition hover:border-amber-400 dark:hover:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40 active:scale-95"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <label className="mt-5 block space-y-2 text-sm font-medium text-slate-700 dark:text-slate-300">
        <span>Số tiền</span>
        <input
          ref={inputRef}
          name="amount"
          type="number"
          min={1000}
          step={1000}
          required
          className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-950 px-4 py-3 text-slate-900 dark:text-white outline-none transition focus:border-amber-500"
          placeholder="100000"
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full sm:w-auto rounded-2xl bg-amber-600 dark:bg-amber-600 px-8 py-4 text-sm font-semibold text-white transition hover:bg-amber-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 shadow-lg shadow-amber-200 dark:shadow-none"
      >
        {loading ? "Đang nạp..." : "Nạp tiền ngay"}
      </button>
    </form>
  );
}
