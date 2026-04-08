"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/shared/toast";

export function UserBalanceControls({ userId }: { userId: number }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [amount, setAmount] = useState(100000);
  const [loading, setLoading] = useState<"add" | "subtract" | "">("");

  async function handleAdjust(mode: "add" | "subtract") {
    setLoading(mode);

    const response = await fetch("/api/admin/user/balance", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, amount, mode }),
    });

    if (response.ok) {
      addToast("success", "Cập nhật số dư thành công!");
      router.refresh();
    } else {
      const data = await response.json();
      addToast("error", data.error ?? "Điều chỉnh thất bại.");
    }

    setLoading("");
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        type="number"
        min={1000}
        step={1000}
        value={amount}
        onChange={(event) => setAmount(Number(event.target.value) || 0)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 sm:w-32"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleAdjust("add")}
          disabled={loading !== ""}
          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {loading === "add" ? "..." : "+"}
        </button>
        <button
          type="button"
          onClick={() => handleAdjust("subtract")}
          disabled={loading !== ""}
          className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {loading === "subtract" ? "..." : "-"}
        </button>
      </div>
    </div>
  );
}
