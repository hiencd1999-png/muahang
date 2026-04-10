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
  twoFactorEnabled,
  role,
  telegramId,
  telegramUsername,
  telegramEnabled,
}: {
  fullName: string;
  username: string;
  balance: number;
  email: string;
  phone: string;
  twoFactorEnabled: boolean;
  role: string;
  telegramId: string | null;
  telegramUsername: string | null;
  telegramEnabled: boolean;
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(twoFactorEnabled);
  const [qrCode, setQrCode] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [loading2FA, setLoading2FA] = useState(false);
  const [loadingReqAdmin, setLoadingReqAdmin] = useState(false);

  const [loadingTelegram, setLoadingTelegram] = useState(false);
  const [telegramLinkInfo, setTelegramLinkInfo] = useState<{link: string, token: string} | null>(null);
  const [isTelegramLinked, setIsTelegramLinked] = useState(!!telegramId);

  async function handleLinkTelegram() {
      setLoadingTelegram(true);
      try {
          const res = await fetch("/api/user/telegram/token", { method: "POST" });
          const data = await res.json();
          if (res.ok) {
              setTelegramLinkInfo({ link: data.link, token: data.token });
          } else {
              addToast("error", data.error || "Lỗi tạo token Telegram.");
          }
      } catch (e) {
          addToast("error", "Lỗi tạo liên kết Telegram.");
      }
      setLoadingTelegram(false);
  }

  async function handleUnlinkTelegram() {
      setLoadingTelegram(true);
      try {
          const res = await fetch("/api/user/telegram/unlink", { method: "DELETE" });
          if (res.ok) {
              setIsTelegramLinked(false);
              setTelegramLinkInfo(null);
              addToast("success", "Đã hủy liên kết Telegram thành công.");
              router.refresh();
          } else {
              const data = await res.json();
              addToast("error", data.error || "Lỗi hủy liên kết.");
          }
      } catch (e) {
          addToast("error", "Lỗi hủy liên kết Telegram.");
      }
      setLoadingTelegram(false);
  }

  async function handleRequestAdmin() {
      setLoadingReqAdmin(true);
      try {
          const res = await fetch("/api/user/admin-request/create", { method: "POST" });
          const data = await res.json();
          if (res.ok) {
              addToast("success", "Đã gửi yêu cầu thành công! Vui lòng đợi SPAdmin duyệt.");
          } else {
              addToast("error", data.error);
          }
      } catch (e) {
          addToast("error", "Lỗi gửi yêu cầu");
      }
      setLoadingReqAdmin(false);
  }

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

  async function handleGenerate2FA() {
      setLoading2FA(true);
      try {
          const res = await fetch("/api/user/2fa/generate", { method: "POST" });
          const data = await res.json();
          if (res.ok) {
              setQrCode(data.qrCode);
              setSecretKey(data.secret);
          } else {
              addToast("error", data.error);
          }
      } catch (e) {
          addToast("error", "Lỗi tạo QR Code");
      }
      setLoading2FA(false);
  }

  async function handleVerify2FA() {
      if (!otpToken || otpToken.length < 6) return;
      setLoading2FA(true);
      try {
          const res = await fetch("/api/user/2fa/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: otpToken })
          });
          const data = await res.json();
          if (res.ok) {
              addToast("success", "Kích hoạt 2FA thành công!");
              setIs2FAEnabled(true);
              setQrCode("");
          } else {
              addToast("error", data.error);
          }
      } catch (e) {
          addToast("error", "Lỗi gửi xác thực OTP");
      }
      setLoading2FA(false);
  }

  async function handleDisable2FA() {
      if (!otpToken || otpToken.length < 6) { return addToast("error", "Nhập mã OTP để vô hiệu hóa"); }
      setLoading2FA(true);
      try {
          const res = await fetch("/api/user/2fa/disable", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: otpToken })
          });
          const data = await res.json();
          if (res.ok) {
              addToast("success", "Đã tắt 2FA.");
              setIs2FAEnabled(false);
              setOtpToken("");
          } else {
              addToast("error", data.error);
          }
      } catch (e) {
          addToast("error", "Lỗi gửi OTP vô hiệu hóa");
      }
      setLoading2FA(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="panel rounded-[1.75rem] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-300">Thông tin tài khoản</p>
        <div className="mt-5 space-y-4">
          {/* Balance Card */}
          <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200 dark:border-amber-900/40 p-5">
            <p className="text-sm text-amber-700 dark:text-amber-500 font-medium">Số dư hiện tại</p>
            <p className="mt-2 text-3xl font-bold text-amber-900 dark:text-amber-200">{formatCurrency(balance)}</p>
            <div className="mt-3 flex gap-2">
              <a
                href="/dashboard/deposit"
                className="flex-1 rounded-xl bg-amber-600 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-amber-700 transition"
              >
                Nạp tiền
              </a>
            </div>
          </div>

          <div className="rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-transparent dark:border-slate-700/80 p-5">
            <p className="text-sm text-slate-500 dark:text-slate-300">Tên người dùng</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{fullName}</p>
          </div>

          {/* Username (Read-only) */}
          <div className="rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-transparent dark:border-slate-700/80 p-5">
            <p className="text-sm text-slate-500 dark:text-slate-300">Username</p>
            <p className="mt-1 text-lg font-semibold text-slate-700 dark:text-slate-300">{username}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Dùng để đăng nhập và không thể thay đổi</p>
          </div>

          {/* Email (Read-only) */}
          <div className="rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-transparent dark:border-slate-700/80 p-5">
            <p className="text-sm text-slate-500 dark:text-slate-300">Email</p>
            <p className="mt-1 text-lg font-semibold text-slate-700 dark:text-slate-300 break-all">{email}</p>
          </div>

          {/* Phone (Read-only) */}
          <div className="rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-transparent dark:border-slate-700/80 p-5">
            <p className="text-sm text-slate-500 dark:text-slate-300">Số điện thoại</p>
            <p className="mt-1 text-lg font-semibold text-slate-700 dark:text-slate-300">{phone}</p>
          </div>

          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-4">
            <p className="text-sm text-amber-800 dark:text-amber-400">
              💡 <strong>Lưu ý:</strong> Tên người dùng hiển thị theo thông tin lúc đăng ký. Username, email và số điện thoại hiện không thể thay đổi sau khi đăng ký.
            </p>
          </div>
        </div>
      </section>

      <form onSubmit={handlePasswordChange} className="panel rounded-[1.75rem] p-6">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Đổi mật khẩu</h2>
        <div className="mt-5 grid gap-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Mật khẩu hiện tại
            <input
              name="currentPassword"
              type="password"
              required
              placeholder="Nhập mật khẩu hiện tại"
              className="mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-950 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none transition focus:border-amber-500"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Mật khẩu mới
            <input
              name="newPassword"
              type="password"
              required
              minLength={6}
              placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
              className="mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-950 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none transition focus:border-amber-500"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Nhập lại mật khẩu mới
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={6}
              placeholder="Xác nhận mật khẩu mới"
              className="mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-950 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none transition focus:border-amber-500"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-5 rounded-2xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
        </button>
      </form>

      {role === "USER" && (
      <section className="panel rounded-[1.75rem] p-6 lg:col-span-2 mt-2 border border-violet-200 dark:border-violet-900/50 bg-violet-50/50 dark:bg-violet-950/10">
          <div className="flex justify-between items-start">
             <div>
                 <h2 className="text-xl font-semibold text-violet-900 dark:text-violet-100">Đăng ký làm Admin</h2>
                 <p className="text-sm text-violet-700 dark:text-violet-300 mt-1">Nâng cấp tài khoản của bạn lên Admin để nhận xử lý đơn cho người dùng khác.</p>
                 <p className="text-sm font-medium text-violet-800 dark:text-violet-200 mt-2"><strong>Điều kiện bắt buộc:</strong> Tài khoản của bạn phải có ít nhất 1 lệnh nạp Crypto thành công từ 30 USDT trở lên.</p>
             </div>
          </div>
          <div className="mt-5">
             <button
               onClick={handleRequestAdmin}
               disabled={loadingReqAdmin}
               className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-violet-700 transition active:scale-95 disabled:opacity-60"
             >
               {loadingReqAdmin ? "Đang gửi yêu cầu..." : "Gửi yêu cầu xét duyệt Admin"}
             </button>
          </div>
      </section>
      )}

      {/* 2FA Security Section */}
      <section className="panel rounded-[1.75rem] p-6 lg:col-span-2 mt-2 border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/10">
        <div className="flex justify-between items-start">
            <div>
                <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">Bảo mật hai lớp (2FA)</h2>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">Sử dụng Google Authenticator để bảo vệ tài khoản khỏi xâm nhập giả mạo.</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${is2FAEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                {is2FAEnabled ? "ĐÃ BẬT" : "ĐÃ TẮT"}
            </span>
        </div>

        <div className="mt-6">
            {!is2FAEnabled ? (
                !qrCode ? (
                    <button onClick={handleGenerate2FA} disabled={loading2FA} className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition active:scale-95 disabled:opacity-60">
                        Bật xác thực 2FA (QR Code)
                    </button>
                ) : (
                    <div className="flex gap-8 items-start flex-col sm:flex-row bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <div className="flex-shrink-0 text-center">
                            <img src={qrCode} alt="2FA QR Code" className="w-48 h-48 rounded-lg shadow-sm mb-3" />
                            <p className="text-xs text-slate-500 font-mono bg-slate-100 dark:bg-slate-800 p-2 rounded-md">{secretKey}</p>
                        </div>
                        <div className="flex-1 space-y-4 w-full">
                            <div className="text-sm text-slate-700 dark:text-slate-300 space-y-2">
                                <p>1. Cài đặt ứng dụng <b>Google Authenticator</b> hoặc Authy trên điện thoại.</p>
                                <p>2. Chọn quét mã QR bên cạnh hoặc nhập thủ công Key.</p>
                                <p>3. Nhập 6 số hiện ra vào ô bên dưới để kích hoạt.</p>
                            </div>
                            <input 
                                value={otpToken} onChange={e => setOtpToken(e.target.value)}
                                placeholder="Nhập mã 6 số..." minLength={6} maxLength={6}
                                className="w-full text-center text-lg tracking-widest rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white px-4 py-3 outline-none focus:border-blue-500"
                            />
                            <button onClick={handleVerify2FA} disabled={loading2FA || otpToken.length < 6} className="w-full rounded-xl bg-emerald-600 p-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60">
                                Xác nhận và Kích Hoạt
                            </button>
                        </div>
                    </div>
                )
            ) : (
                <div className="flex flex-col sm:flex-row gap-3 items-center bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <input 
                        value={otpToken} onChange={e => setOtpToken(e.target.value)}
                        placeholder="Nhập mã 6 số từ App để vô hiệu hóa..." minLength={6} maxLength={6}
                        className="flex-1 w-full text-center tracking-widest rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white px-4 py-3 outline-none focus:border-rose-500"
                    />
                    <button onClick={handleDisable2FA} disabled={loading2FA || otpToken.length < 6} className="w-full sm:w-auto rounded-xl bg-rose-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60 shrink-0">
                        Tắt & Gỡ Bỏ 2FA
                    </button>
                </div>
            )}
        </div>
      </section>

      {/* Telegram Link Section */}
      <section className="panel rounded-[1.75rem] p-6 lg:col-span-2 mt-2 border border-sky-200 dark:border-sky-900/50 bg-sky-50/50 dark:bg-sky-950/10">
        <div className="flex justify-between items-start">
            <div>
                <h2 className="text-xl font-semibold text-sky-900 dark:text-sky-100 flex items-center gap-2">
                  <svg className="h-6 w-6 text-sky-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .24z"/></svg>
                  Nhận thông báo qua Telegram
                </h2>
                <p className="text-sm text-sky-700 dark:text-sky-300 mt-1">Liên kết với bot hỗ trợ để nhận thông báo tức thì về đơn hàng và nạp tiền.</p>
            </div>
            {!telegramEnabled ? (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                    BẢO TRÌ
                </span>
            ) : (
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${isTelegramLinked ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                    {isTelegramLinked ? "ĐÃ LIÊN KẾT" : "CHƯA LIÊN KẾT"}
                </span>
            )}
        </div>

        <div className="mt-6">
            {!telegramEnabled ? (
                <div className="flex bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-center items-center justify-center text-sm font-medium text-slate-500">
                    Hệ thống Telegram Bot hiện đang bảo trì nhằm nâng cấp. Vui lòng quay lại sau!
                </div>
            ) : !isTelegramLinked ? (
                !telegramLinkInfo ? (
                    <button onClick={handleLinkTelegram} disabled={loadingTelegram} className="rounded-xl bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-sky-700 transition active:scale-95 disabled:opacity-60 flex items-center gap-2">
                        <span>Liên kết Telegram</span>
                    </button>
                ) : (
                    <div className="flex gap-8 items-start flex-col sm:flex-row bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <div className="flex-1 space-y-4 w-full text-sm text-slate-700 dark:text-slate-300">
                            <p>1. Nhấp vào nút bên dưới để mở ứng dụng Telegram.</p>
                            <p>2. Bấm <b>Start</b> (Bắt đầu) trong đoạn chat với Bot.</p>
                            <p>3. Bot sẽ tự động thông báo liên kết thành công. Sau đó bạn hãy tải lại trang này.</p>
                            
                            <div className="mt-4 flex gap-4 items-center">
                              <a href={telegramLinkInfo.link} target="_blank" rel="noreferrer" className="inline-block rounded-xl bg-sky-600 p-3 text-sm font-semibold text-white transition hover:bg-sky-700 shadow-sm">
                                  Mở Telegram & Bắt đầu
                              </a>
                              <p className="text-xs text-sky-600 bg-sky-50 px-3 py-2 rounded-lg font-mono">Token: {telegramLinkInfo.token}</p>
                            </div>
                        </div>
                    </div>
                )
            ) : (
                <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Tài khoản Telegram đã liên kết: <span className="font-bold text-sky-600">@{telegramUsername || "Unknown"}</span>
                    </p>
                    <button onClick={handleUnlinkTelegram} disabled={loadingTelegram} className="w-full sm:w-auto rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 px-6 py-2 border border-rose-200 dark:border-rose-900/50 text-sm font-semibold transition hover:bg-rose-200 dark:hover:bg-rose-900/50 disabled:opacity-60 shrink-0 mt-4 sm:mt-0">
                        Hủy liên kết
                    </button>
                </div>
            )}
        </div>
      </section>

    </div>
  );
}
