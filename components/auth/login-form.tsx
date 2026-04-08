"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/shared/toast";
import { getPostLoginRedirect } from "@/lib/roles";

export function LoginForm() {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    try {
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
      window.location.href = getPostLoginRedirect(data.user.role);
    } catch (error) {
      addToast("error", "Không thể kết nối đến server.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel animate-rise w-full rounded-[2rem] p-8 sm:p-10">
      <div className="mb-8 space-y-3">
        <span className="inline-flex rounded-full bg-amber-100 dark:bg-amber-900/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-amber-800 dark:text-amber-300">
          Dang nhap
        </span>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Truy cập hệ thống đặt đơn.</h1>
        <p className="text-sm leading-7 text-slate-600 dark:text-slate-400">
          Nhập tài khoản để quản lý số dư, tạo đơn Shopee và theo dõi trạng thái xử lý.
        </p>
      </div>

      <div className="space-y-5">
        <label className="block space-y-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <span>Tài khoản đăng nhập</span>
          <input
            name="identifier"
            required
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-white outline-none transition focus:border-amber-500"
            placeholder="Nhập username, email hoặc số điện thoại"
          />
          <p className="text-xs text-slate-500 dark:text-slate-500">Bạn có thể dùng username, email hoặc số điện thoại để đăng nhập</p>
        </label>

        <label className="block space-y-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <span>Password</span>
          <div className="relative">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              required
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-500"
              placeholder="nhap password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                </svg>
              )}
            </button>
          </div>
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
