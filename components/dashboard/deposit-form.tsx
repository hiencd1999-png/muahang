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
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const amount = Number(formData.get("amount"));

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
    event.currentTarget.reset();
    router.refresh();
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="panel rounded-[1.75rem] p-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-slate-900">Nạp tiền vào tài khoản</h2>
        <p className="text-sm text-slate-600">Nhập số tiền VND để cộng trực tiếp vào balance.</p>
      </div>

      {/* Preset buttons */}
      <div className="mt-5 space-y-2">
        <p className="text-sm font-medium text-slate-700">Nạp nhanh:</p>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => handlePreset(preset.value)}
              className="rounded-lg border-2 border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:border-amber-400 hover:bg-amber-100 active:scale-95"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <label className="mt-5 block space-y-2 text-sm font-medium text-slate-700">
        <span>Số tiền</span>
        <input
          ref={inputRef}
          name="amount"
          type="number"
          min={1000}
          step={1000}
          required
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-500"
          placeholder="100000"
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="mt-5 rounded-2xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Đang nạp..." : "Nạp tiền"}
      </button>
    </form>
  );
}
