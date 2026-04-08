"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/shared/toast";
import { formatCurrency } from "@/lib/format";

export function ProfileForm({
  fullName,
  username,
  balance,
  email,
  phone,
}: {
  fullName: string;
  username: string;
  balance: number;
  email: string;
  phone: string;
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handlePasswordChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      addToast("error", "Mật khẩu mới và xác nhận mật khẩu không khớp");
      return;
    }

    if (newPassword.length < 6) {
      addToast("error", "Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        addToast("error", data.error ?? "Đổi mật khẩu thất bại");
      } else {
        addToast("success", "Mật khẩu cập nhật thành công!");
        event.currentTarget.reset();
        router.refresh();
      }
    } catch (error) {
      addToast("error", "Lỗi đổi mật khẩu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="panel rounded-[1.75rem] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Thông tin tài khoản</p>
        <div className="mt-5 space-y-4">
          {/* Balance Card */}
          <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-5">
            <p className="text-sm text-amber-700 font-medium">Số dư hiện tại</p>
            <p className="mt-2 text-3xl font-bold text-amber-900">{formatCurrency(balance)}</p>
            <div className="mt-3 flex gap-2">
              <a
                href="/dashboard/deposit"
                className="flex-1 rounded-xl bg-amber-600 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-amber-700 transition"
              >
                Nạp tiền
              </a>
            </div>
          </div>

          <div className="rounded-2xl bg-white/80 p-5">
            <p className="text-sm text-slate-500">Tên người dùng</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{fullName}</p>
          </div>

          {/* Username (Read-only) */}
          <div className="rounded-2xl bg-white/80 p-5">
            <p className="text-sm text-slate-500">Username</p>
            <p className="mt-1 text-lg font-semibold text-slate-700">{username}</p>
            <p className="mt-1 text-xs text-slate-500">Dùng để đăng nhập và không thể thay đổi</p>
          </div>

          {/* Email (Read-only) */}
          <div className="rounded-2xl bg-white/80 p-5">
            <p className="text-sm text-slate-500">Email</p>
            <p className="mt-1 text-lg font-semibold text-slate-700 break-all">{email}</p>
          </div>

          {/* Phone (Read-only) */}
          <div className="rounded-2xl bg-white/80 p-5">
            <p className="text-sm text-slate-500">Số điện thoại</p>
            <p className="mt-1 text-lg font-semibold text-slate-700">{phone}</p>
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <p className="text-sm text-blue-700">
              💡 <strong>Lưu ý:</strong> Tên người dùng hiển thị theo thông tin lúc đăng ký. Username, email và số điện thoại hiện không thể thay đổi sau khi đăng ký.
            </p>
          </div>
        </div>
      </section>

      <form onSubmit={handlePasswordChange} className="panel rounded-[1.75rem] p-6">
        <h2 className="text-xl font-semibold text-slate-900">Đổi mật khẩu</h2>
        <div className="mt-5 grid gap-4">
          <label className="block text-sm font-medium text-slate-700">
            Mật khẩu hiện tại
            <input
              name="currentPassword"
              type="password"
              required
              placeholder="Nhập mật khẩu hiện tại"
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-500"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Mật khẩu mới
            <input
              name="newPassword"
              type="password"
              required
              minLength={6}
              placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-500"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Nhập lại mật khẩu mới
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={6}
              placeholder="Xác nhận mật khẩu mới"
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-500"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-5 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
        </button>
      </form>
    </div>
  );
}
