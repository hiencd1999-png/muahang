"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/shared/toast";

const fullNameRegex = /^[A-Za-zÀ-ỹ]+\s[A-Za-zÀ-ỹ\s]+$/;
const usernameRegex = /^(?!\d)[a-z0-9_]{4,20}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const phoneRegex = /^(03|05|07|08|09)[0-9]{8}$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export function RegisterForm() {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get("fullName") ?? "").trim();
    const username = String(formData.get("username") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    // Client-side validation
    if (!fullName) {
      addToast("error", "Không được để trống");
      setLoading(false);
      return;
    }

    if (fullName.split(/\s+/).length < 2) {
      addToast("error", "Phải có ít nhất 2 từ");
      setLoading(false);
      return;
    }

    if (!fullNameRegex.test(fullName)) {
      addToast("error", "Chỉ được chứa chữ cái");
      setLoading(false);
      return;
    }

    if (!username) {
      addToast("error", "Không được để trống");
      setLoading(false);
      return;
    }

    if (!usernameRegex.test(username)) {
      addToast("error", "4-20 ký tự, chữ thường, số, _, không bắt đầu bằng số");
      setLoading(false);
      return;
    }

    if (!email) {
      addToast("error", "Không được để trống");
      setLoading(false);
      return;
    }

    if (!emailRegex.test(email)) {
      addToast("error", "Email không hợp lệ");
      setLoading(false);
      return;
    }

    if (!phone) {
      addToast("error", "Không được để trống");
      setLoading(false);
      return;
    }

    if (!phoneRegex.test(phone)) {
      addToast("error", "SĐT không hợp lệ");
      setLoading(false);
      return;
    }

    if (!password) {
      addToast("error", "Không được để trống");
      setLoading(false);
      return;
    }

    if (!passwordRegex.test(password)) {
      addToast("error", "Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      addToast("error", "Mật khẩu nhập lại không khớp");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, username, email, phone, password }),
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
          <span>Tên người dùng</span>
          <input
            name="fullName"
            required
            minLength={3}
            maxLength={60}
            placeholder="Nguyễn Văn A"
            pattern="^[A-Za-zÀ-ỹ]+\s[A-Za-zÀ-ỹ\s]+$"
            title="Không được để trống, phải có ít nhất 2 từ và chỉ chứa chữ cái"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
          />
          <p className="text-xs text-slate-500">Không để trống, tối thiểu 2 từ và chỉ chứa chữ cái</p>
        </label>

        <label className="block space-y-2 text-sm font-medium text-slate-700">
          <span>Username</span>
          <input
            name="username"
            required
            minLength={4}
            maxLength={20}
            placeholder="datdon_user"
            pattern="^(?!\d)[a-z0-9_]{4,20}$"
            title="4-20 ký tự, chữ thường, số, _, không bắt đầu bằng số"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
          />
          <p className="text-xs text-slate-500">4-20 ký tự, chữ thường, số, _, không bắt đầu bằng số</p>
        </label>

        <label className="block space-y-2 text-sm font-medium text-slate-700">
          <span>Email</span>
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            title="Email phải đúng định dạng hợp lệ và không chứa khoảng trắng"
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
            inputMode="numeric"
            pattern="^(03|05|07|08|09)[0-9]{8}$"
            placeholder="0912345678"
            title="SĐT Việt Nam gồm 10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
          />
          <p className="text-xs text-slate-500">10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09</p>
        </label>

        <label className="block space-y-2 text-sm font-medium text-slate-700">
          <span>Mật khẩu</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="Ít nhất 8 ký tự"
            title="Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500"
          />
          <p className="text-xs text-slate-500">Ít nhất 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt</p>
        </label>

        <label className="block space-y-2 text-sm font-medium text-slate-700">
          <span>Nhập lại mật khẩu</span>
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            placeholder="Xác nhận mật khẩu"
            title="Phải trùng với mật khẩu đã nhập"
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
