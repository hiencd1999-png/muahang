"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/shared/toast";

export function RegisterForm() {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    // Client-side validation
    if (password !== confirmPassword) {
      addToast("error", "Mật khẩu nhập lại không khớp");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      addToast("error", "Mật khẩu phải có ít nhất 6 ký tự");
      setLoading(false);
      return;
    }

    if (!/[A-Z]/.test(password)) {
      addToast("error", "Mật khẩu phải có ít nhất 1 chữ cái viết hoa");
      setLoading(false);
      return;
    }

    if (!/[0-9]/.test(password)) {
      addToast("error", "Mật khẩu phải có ít nhất 1 chữ số");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, phone, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        addToast("error", data.error ?? "Đăng ký thất bại");
        setLoading(false);
        return;
      }

      addToast("success", "Tạo tài khoản thành công!");
      event.currentTarget.reset();
      router.push("/login");
      router.refresh();
    } catch (error) {
      addToast("error", "Lỗi đăng ký");
      console.error(error);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel animate-rise w-full rounded-[2rem] p-8 sm:p-10">
      <div className="mb-8 space-y-3">
        <span className="inline-flex rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-teal-800">
          Tạo tài khoản
        </span>
        <h1 className="text-3xl font-semibold text-slate-900">Đăng ký người dùng mới.</h1>
        <p className="text-sm leading-7 text-slate-600">
          Nhập thông tin cá nhân và mật khẩu để tạo tài khoản mới.
        </p>
      </div>

      <div className="space-y-5">
        <label className="block space-y-2 text-sm font-medium text-slate-700">
          <span>Username</span>
          <input
            name="username"
            required
            minLength={3}
            maxLength={30}
            placeholder="datdon_user (3-30 ký tự)"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
          />
          <p className="text-xs text-slate-500">Chỉ được chứa chữ, số, dấu chấm, gạch ngang</p>
        </label>

        <label className="block space-y-2 text-sm font-medium text-slate-700">
          <span>Email</span>
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
          />
          <p className="text-xs text-slate-500">Email phải hợp lệ và duy nhất</p>
        </label>

        <label className="block space-y-2 text-sm font-medium text-slate-700">
          <span>Số điện thoại</span>
          <input
            name="phone"
            type="tel"
            required
            placeholder="0912345678 hoặc +84912345678"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
          />
          <p className="text-xs text-slate-500">Số điện thoại Việt Nam (bắt đầu bằng 0 hoặc +84)</p>
        </label>

        <label className="block space-y-2 text-sm font-medium text-slate-700">
          <span>Mật khẩu</span>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            placeholder="Ít nhất 6 ký tự (có số và chữ hoa)"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
          />
          <p className="text-xs text-slate-500">Phải có ít nhất 1 chữ hoa và 1 chữ số</p>
        </label>

        <label className="block space-y-2 text-sm font-medium text-slate-700">
          <span>Nhập lại mật khẩu</span>
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={6}
            placeholder="Xác nhận mật khẩu"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-7 w-full rounded-2xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Đang tạo tài khoản..." : "Đăng ký"}
      </button>

      <p className="mt-5 text-sm text-slate-600">
        Đã có tài khoản? <Link href="/login" className="font-semibold text-teal-700">Đăng nhập</Link>
      </p>
    </form>
  );
}
