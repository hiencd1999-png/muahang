"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/shared/toast";

export default function SettingsPage() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [configs, setConfigs] = useState({
    botToken: "",
    enabled: false,
    notifyUserOrder: true,
    notifyUserDeposit: true,
    notifyAdminOrder: true,
    notifyAdminDeposit: true,
    notifyAdminWithdrawal: true,
    cryptoWalletBsc: "",
    cryptoWalletTrx: "",
    usdtRate: "25500",
    binanceProxy: "",
    binanceKey: "",
    binanceSecret: "",
    shopeeSpcSt: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/settings", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setConfigs({
            botToken: data.botToken || "",
            enabled: data.enabled || false,
            notifyUserOrder: data.notifyUserOrder ?? true,
            notifyUserDeposit: data.notifyUserDeposit ?? true,
            notifyAdminOrder: data.notifyAdminOrder ?? true,
            notifyAdminDeposit: data.notifyAdminDeposit ?? true,
            notifyAdminWithdrawal: data.notifyAdminWithdrawal ?? true,
            cryptoWalletBsc: data.cryptoWalletBsc || "",
            cryptoWalletTrx: data.cryptoWalletTrx || "",
            usdtRate: data.usdtRate || "25500",
            binanceProxy: data.binanceProxy || "",
            binanceKey: data.binanceKey || "",
            binanceSecret: data.binanceSecret || "",
            shopeeSpcSt: data.shopeeSpcSt || "",
          });
        }
      } catch {
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configs),
      });

      if (res.ok) {
        addToast("success", "Lưu cấu hình hệ thống thành công");
      } else {
        const data = await res.json();
        addToast("error", data.error || "Lưu thất bại");
      }
    } catch {
      addToast("error", "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Đang tải cấu hình...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="panel p-6 rounded-[2rem]">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Cấu hình hệ thống</h1>
        <p className="mt-1 text-sm text-slate-500">Các tùy chọn sẽ được áp dụng cho toàn bộ nền tảng.</p>
      </div>

      <form onSubmit={handleSave} className="grid gap-6 lg:grid-cols-2">
        {/* Telegram Config Section */}
        <section className="panel p-6 rounded-[2rem] space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Cấu hình Telegram Bot</h2>
              <p className="mt-1 text-sm text-slate-500">Nhập thông tin xác thực do BotFather cấp.</p>
            </div>
            
            <label className="relative inline-flex cursor-pointer items-center">
              <input 
                type="checkbox" 
                className="peer sr-only" 
                checked={configs.enabled}
                onChange={e => setConfigs({...configs, enabled: e.target.checked})}
              />
              <div className="peer h-6 w-11 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-amber-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-4 peer-focus:ring-amber-300 dark:border-gray-600 dark:bg-slate-700 dark:peer-focus:ring-amber-800"></div>
              <span className="ml-3 text-sm font-medium text-slate-900 dark:text-slate-300">
                {configs.enabled ? "Đang bật" : "Tắt"}
              </span>
            </label>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">HTTP API Token</span>
              <input
                type="text"
                placeholder="Ví dụ: 123456789:ABCdefGHIjklmNOPqrstUVWxyz"
                value={configs.botToken}
                onChange={e => setConfigs({...configs, botToken: e.target.value})}
                className="mt-1 block w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </label>
          </div>

          <div className="pt-4 space-y-4">
            <h3 className="font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">Tùy chọn nhận thông báo User</h3>
            <div className="flex items-center gap-3">
               <input
                 type="checkbox"
                 id="notifyUserOrder"
                 checked={configs.notifyUserOrder}
                 onChange={e => setConfigs({...configs, notifyUserOrder: e.target.checked})}
                 className="h-5 w-5 rounded border-slate-300 text-amber-600 focus:ring-amber-600"
               />
               <label htmlFor="notifyUserOrder" className="text-sm text-slate-700 dark:text-slate-300">User nhận thông báo thay đổi trạng thái đơn hàng</label>
            </div>
            <div className="flex items-center gap-3">
               <input
                 type="checkbox"
                 id="notifyUserDeposit"
                 checked={configs.notifyUserDeposit}
                 onChange={e => setConfigs({...configs, notifyUserDeposit: e.target.checked})}
                 className="h-5 w-5 rounded border-slate-300 text-amber-600 focus:ring-amber-600"
               />
               <label htmlFor="notifyUserDeposit" className="text-sm text-slate-700 dark:text-slate-300">User nhận thông báo nạp/rút tiền thành công</label>
            </div>
          </div>

          <div className="pt-4 space-y-4">
            <h3 className="font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">Tùy chọn nhận thông báo Admin/SPAdmin</h3>
            <div className="flex items-center gap-3">
               <input
                 type="checkbox"
                 id="notifyAdminOrder"
                 checked={configs.notifyAdminOrder}
                 onChange={e => setConfigs({...configs, notifyAdminOrder: e.target.checked})}
                 className="h-5 w-5 rounded border-slate-300 text-amber-600 focus:ring-amber-600"
               />
               <label htmlFor="notifyAdminOrder" className="text-sm text-slate-700 dark:text-slate-300">Phát sóng thông báo khi có đơn mới</label>
            </div>
            <div className="flex items-center gap-3">
               <input
                 type="checkbox"
                 id="notifyAdminDeposit"
                 checked={configs.notifyAdminDeposit}
                 onChange={e => setConfigs({...configs, notifyAdminDeposit: e.target.checked})}
                 className="h-5 w-5 rounded border-slate-300 text-amber-600 focus:ring-amber-600"
               />
               <label htmlFor="notifyAdminDeposit" className="text-sm text-slate-700 dark:text-slate-300">Phát sóng thông báo duyệt yêu cầu nạp tiền mớI</label>
            </div>
            <div className="flex items-center gap-3">
               <input
                 type="checkbox"
                 id="notifyAdminWithdrawal"
                 checked={configs.notifyAdminWithdrawal}
                 onChange={e => setConfigs({...configs, notifyAdminWithdrawal: e.target.checked})}
                 className="h-5 w-5 rounded border-slate-300 text-amber-600 focus:ring-amber-600"
               />
               <label htmlFor="notifyAdminWithdrawal" className="text-sm text-slate-700 dark:text-slate-300">Phát sóng cập nhật lệnh rút tiền</label>
            </div>
          </div>

        </section>

        {/* Crypto Config Section */}
        <section className="panel p-6 rounded-[2rem] space-y-6 lg:col-span-2">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Cấu hình Hệ thống Nạp tiền Crypto</h2>
            <p className="mt-1 text-sm text-slate-500">Cấu hình ví nhận tiền USDT và tỷ lệ quy đổi khi người dùng nạp tiền.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Ví Binance USDT (BEP20)</span>
              <input
                type="text"
                placeholder="Nhập địa chỉ ví BEP20"
                value={configs.cryptoWalletBsc}
                onChange={e => setConfigs({...configs, cryptoWalletBsc: e.target.value})}
                className="mt-1 block w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Ví Binance USDT (TRC20)</span>
              <input
                type="text"
                placeholder="Nhập địa chỉ ví TRC20"
                value={configs.cryptoWalletTrx}
                onChange={e => setConfigs({...configs, cryptoWalletTrx: e.target.value})}
                className="mt-1 block w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Binance API Key</span>
              <input
                type="password"
                placeholder="Nhập Binance API Key"
                value={configs.binanceKey}
                onChange={e => setConfigs({...configs, binanceKey: e.target.value})}
                className="mt-1 block w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Binance API Secret</span>
              <input
                type="password"
                placeholder="Nhập Binance API Secret"
                value={configs.binanceSecret}
                onChange={e => setConfigs({...configs, binanceSecret: e.target.value})}
                className="mt-1 block w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Proxy quét API Binance (Nhập cấu hình HTTP Proxy nếu có)</span>
              <input
                type="text"
                placeholder="Ví dụ: 103.11.22.33:8080:user:pass (Hệ thống sẽ tự nhận diện)"
                value={configs.binanceProxy}
                onChange={e => setConfigs({...configs, binanceProxy: e.target.value})}
                className="mt-1 block w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
              <p className="mt-1 text-xs text-slate-500">Giúp hệ thống vượt tường lửa hoặc giới hạn truy cập từ Binance. Bỏ trống nếu server VPS truy cập Binance bình thường.</p>
            </label>

            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Tỷ lệ chuyển đổi (1 USDT = ? VNĐ)</span>
              <input
                type="number"
                placeholder="25500"
                value={configs.usdtRate}
                onChange={e => setConfigs({...configs, usdtRate: e.target.value})}
                className="mt-1 block w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
              <p className="mt-1 text-xs text-slate-500">Người dùng chuyển USDT sẽ tự động nhân với tỷ lệ này vào số dư VNĐ. Mặc định 25500.</p>
            </label>
          </div>
        </section>

        {/* Shopee Config Section */}
        <section className="panel p-6 rounded-[2rem] space-y-6 lg:col-span-2">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Cấu hình Shopee</h2>
            <p className="mt-1 text-sm text-slate-500">Cấu hình Cookie dùng để lấy link sản phẩm và phân tích địa chỉ.</p>
          </div>

          <div className="grid gap-6">
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Cookie SPC_ST</span>
              <input
                type="text"
                placeholder="Ví dụ: SPC_ST=ABCDEFGHIJKLMNOPQRSTUVWXYZ..."
                value={configs.shopeeSpcSt}
                onChange={e => setConfigs({...configs, shopeeSpcSt: e.target.value})}
                className="mt-1 block w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
              <p className="mt-1 text-xs text-slate-500">Mặc định ưu tiên cấu hình này hoặc cấu hình có trong file .env. Nếu cả hai đều trống sẽ tự động lấy Cookie từ đơn hàng gần nhất có SPC_ST (dùng cho phân tích địa chỉ).</p>
            </label>
          </div>
        </section>

        <section className="space-y-6 lg:col-span-2">
          <div className="panel p-6 rounded-[2rem]">
             <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Lưu lại thay đổi</h2>
             <button
               type="submit"
               disabled={saving}
               className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-600 py-3 font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
             >
               {saving ? "Đang lưu..." : "Áp dụng cấu hình"}
             </button>
          </div>
          
          <div className="panel p-6 rounded-[2rem] bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30">
            <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Hướng dẫn lấy Bot Token
            </h3>
            <div className="mt-3 text-sm text-indigo-800 dark:text-indigo-400 space-y-2">
               <p>1. Tìm kiếm <b>@BotFather</b> trên Telegram</p>
               <p>2. Gửi lệnh <code>/newbot</code> và làm theo yêu cầu</p>
               <p>3. Copy mã HTTP API Token hiển thị màu đỏ</p>
               <p>4. Dán vào ô bên trái để kích hoạt!</p>
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}
