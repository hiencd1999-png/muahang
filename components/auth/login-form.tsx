"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/shared/toast";

export function LoginForm() {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      addToast("error", data.error ?? "Đăng nhập thất bại.");
      setLoading(false);
      return;
    }

    if (!data.user) {
      addToast("error", "Phản hồi không hợp lệ từ server.");
      setLoading(false);
      return;
    }

    addToast("success", "Đăng nhập thành công!");
    window.location.href = data.user.role === "ADMIN" ? "/admin" : "/dashboard";
  }

  return (
    <form onSubmit={handleSubmit} className="panel animate-rise w-full rounded-[2rem] p-8 sm:p-10">
      <div className="mb-8 space-y-3">
        <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-amber-800">
          Dang nhap
        </span>
        <h1 className="text-3xl font-semibold text-slate-900">Truy cập hệ thống đặt đơn.</h1>
        <p className="text-sm leading-7 text-slate-600">
          Nhập tài khoản để quản lý số dư, tạo đơn Shopee và theo dõi trạng thái xử lý.
        </p>
      </div>

      <div className="space-y-5">
        <label className="block space-y-2 text-sm font-medium text-slate-700">
          <span>Username</span>
          <input
            name="username"
            required
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-500"
            placeholder="nhap username"
          />
        </label>

        <label className="block space-y-2 text-sm font-medium text-slate-700">
          <span>Password</span>
          <input
            name="password"
            type="password"
            required
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-500"
            placeholder="nhap password"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-7 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>

      <p className="mt-5 text-sm text-slate-600">
        Chưa có tài khoản? <Link href="/register" className="font-semibold text-amber-700">Đăng ký</Link>
      </p>
    </form>
  );
}
