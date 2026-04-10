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

import { getPostLoginRedirect } from "@/lib/roles";
import { Logo } from "@/components/shared/logo";

export function RegisterForm() {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
      
      // Tự động đăng nhập và chuyển hướng đến Dashboard
      setTimeout(() => {
        window.location.href = getPostLoginRedirect(data.user.role);
      }, 500);
      
    } catch (error) {
      // Chỉ báo lỗi nếu chưa thành công (loading vẫn true)
      setLoading(false);
      console.error("Registration error:", error);
      addToast("error", "Lỗi mạng hoặc server không phản hồi");
    }
  }

  return (
    <form method="POST" onSubmit={handleSubmit} className="panel animate-rise w-full rounded-[2rem] p-8 sm:p-10">
      <div className="mb-8 space-y-3">
        <div className="mb-6"><Logo /></div>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Đăng ký người dùng mới.</h1>
        <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
          Nhập thông tin cá nhân và mật khẩu để tạo tài khoản mới.
        </p>
      </div>

      <div className="space-y-5">
        <label className="block space-y-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <span>Tên người dùng</span>
          <input
            name="fullName"
            required
            minLength={3}
            maxLength={60}
            placeholder="Nguyễn Văn A"
            pattern="^[A-Za-zÀ-ỹ]+\s[A-Za-zÀ-ỹ\s]+$"
            title="Không được để trống, phải có ít nhất 2 từ và chỉ chứa chữ cái"
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-white outline-none transition focus:border-amber-500"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">Không để trống, tối thiểu 2 từ và chỉ chứa chữ cái</p>
        </label>

        <label className="block space-y-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <span>Username</span>
          <input
            name="username"
            required
            minLength={4}
            maxLength={20}
            placeholder="datdon_user"
            pattern="^(?!\d)[a-z0-9_]{4,20}$"
            title="4-20 ký tự, chữ thường, số, _, không bắt đầu bằng số"
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-white outline-none transition focus:border-amber-500"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">4-20 ký tự, chữ thường, số, _, không bắt đầu bằng số</p>
        </label>

        <label className="block space-y-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <span>Email</span>
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            title="Email phải đúng định dạng hợp lệ và không chứa khoảng trắng"
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-white outline-none transition focus:border-amber-500"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">Email phải hợp lệ và duy nhất</p>
        </label>

        <label className="block space-y-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <span>Số điện thoại</span>
          <input
            name="phone"
            type="tel"
            required
            inputMode="numeric"
            pattern="^(03|05|07|08|09)[0-9]{8}$"
            placeholder="0912345678"
            title="SĐT Việt Nam gồm 10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09"
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-white outline-none transition focus:border-amber-500"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09</p>
        </label>

        <label className="block space-y-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <span>Mật khẩu</span>
          <div className="relative">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              placeholder="Ít nhất 8 ký tự"
              title="Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt"
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-white outline-none transition focus:border-amber-500"
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
          <p className="text-xs text-slate-500 dark:text-slate-400">Ít nhất 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt</p>
        </label>

        <label className="block space-y-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <span>Nhập lại mật khẩu</span>
          <div className="relative">
            <input
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              required
              minLength={8}
              placeholder="Xác nhận mật khẩu"
              title="Phải trùng với mật khẩu đã nhập"
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-white outline-none transition focus:border-amber-500"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
            >
              {showConfirmPassword ? (
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
        className="mt-7 w-full rounded-2xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Đang tạo tài khoản..." : "Đăng ký"}
      </button>

      <p className="mt-5 text-sm text-slate-600 dark:text-slate-300">
        Đã có tài khoản? <Link href="/login" className="font-semibold text-amber-600 dark:text-amber-500">Đăng nhập</Link>
      </p>
    </form>
  );
}
