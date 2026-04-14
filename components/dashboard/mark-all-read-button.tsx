"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/shared/toast";

export function MarkAllReadButton() {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleMarkAllRead = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/user/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });

      if (!res.ok) {
        throw new Error("Failed");
      }

      addToast("success", "Đã đánh dấu tất cả là đã đọc");
      router.refresh();
    } catch (err) {
      addToast("error", "Có lỗi xảy ra, vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleMarkAllRead}
      disabled={loading}
      className="rounded-xl bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-200 disabled:opacity-50 transition"
    >
      {loading ? "Đang xử lý..." : "Đánh dấu tất cả đã đọc"}
    </button>
  );
}
