"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/shared/toast";
import { Loader2 } from "lucide-react";

export function AdminBankSettings() {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [banks, setBanks] = useState<{ id: number, name: string, shortName: string }[]>([]);
    
    const [config, setConfig] = useState({
        bankName: "",
        accountNumber: "",
        accountName: "",
        branch: "",
        contactInfo: "",
        web2mToken: "",
        isActive: true
    });

    useEffect(() => {
        fetch(`/api/admin/bank-config?t=${Date.now()}`, { cache: "no-store", headers: { 'pragma': 'no-cache', 'cache-control': 'no-cache' } })
            .then(res => res.json())
            .then(data => {
                if (data.config) {
                    setConfig({
                        bankName: data.config.bankName || "",
                        accountNumber: data.config.accountNumber || "",
                        accountName: data.config.accountName || "",
                        branch: data.config.branch || "",
                        contactInfo: data.config.contactInfo || "",
                        web2mToken: data.config.web2mToken || "",
                        isActive: data.config.isActive
                    });
                }
            })
            .finally(() => setLoading(false));

        // Fetch VietQR banks
        fetch("https://api.vietqr.io/v2/banks")
            .then(res => res.json())
            .then(data => {
                if(data.data) setBanks(data.data);
            })
            .catch(() => {});
    }, []);

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch("/api/admin/bank-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config)
            });
            const data = await res.json();
            if (res.ok) {
                addToast("success", "Lưu cấu hình thành công");
            } else {
                addToast("error", data.error || "Có lỗi xảy ra");
            }
        } catch (e) {
            addToast("error", "Lỗi đường truyền kết nối");
        }
        setSaving(false);
    }

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-amber-500" /></div>;

    return (
        <form onSubmit={handleSave} className="panel p-6 space-y-6 max-w-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                    <h2 className="text-lg font-semibold dark:text-white">Trạng thái cấu hình</h2>
                    <p className="text-sm text-slate-500">Bật để cho phép người dùng chọn bạn khi nạp Bank.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={config.isActive} onChange={(e) => setConfig({ ...config, isActive: e.target.checked })} />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-amber-500"></div>
                </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
                <label className="block space-y-2 text-sm font-medium">
                    <span className="text-slate-700 dark:text-slate-300">Tên ngân hàng (Bank) <span className="text-red-500">*</span></span>
                    {banks.length > 0 ? (
                        <div className="relative">
                            <input 
                                list="bank-list" 
                                required 
                                value={config.bankName} 
                                onChange={e => setConfig({...config, bankName: e.target.value})} 
                                placeholder="🔍 Nhập kí tự để tìm nhanh Ngân Hàng..." 
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 outline-none focus:border-amber-500 transition"
                            />
                            <datalist id="bank-list">
                                {banks.map(bank => (
                                    <option key={bank.id} value={`${bank.shortName} - ${bank.name}`} />
                                ))}
                            </datalist>
                        </div>
                    ) : (
                        <input required type="text" value={config.bankName} onChange={e => setConfig({...config, bankName: e.target.value})} placeholder="VD: VCB, MBBank..." className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 outline-none focus:border-amber-500 transition"/>
                    )}
                </label>
                <label className="block space-y-2 text-sm font-medium">
                    <span className="text-slate-700 dark:text-slate-300">Tên chủ tài khoản <span className="text-red-500">*</span></span>
                    <input required type="text" value={config.accountName} onChange={e => setConfig({...config, accountName: e.target.value.toUpperCase()})} placeholder="VD: NGUYEN VAN A" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 outline-none focus:border-amber-500 transition"/>
                </label>
                <label className="block space-y-2 text-sm font-medium sm:col-span-2">
                    <span className="text-slate-700 dark:text-slate-300">Số tài khoản <span className="text-red-500">*</span></span>
                    <input required type="text" value={config.accountNumber} onChange={e => setConfig({...config, accountNumber: e.target.value})} placeholder="Nhập số tài khoản" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 outline-none focus:border-amber-500 transition font-mono"/>
                </label>
                <label className="block space-y-2 text-sm font-medium">
                    <span className="text-slate-700 dark:text-slate-300">Chi nhánh (Không bắt buộc)</span>
                    <input type="text" value={config.branch} onChange={e => setConfig({...config, branch: e.target.value})} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 outline-none focus:border-amber-500 transition"/>
                </label>
                <label className="block space-y-2 text-sm font-medium">
                    <span className="text-slate-700 dark:text-slate-300">Liên hệ hỗ trợ <span className="text-red-500">*</span></span>
                    <input required type="text" value={config.contactInfo} onChange={e => setConfig({...config, contactInfo: e.target.value})} placeholder="SĐT Zalo hoặc link Tele/FB" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 outline-none focus:border-amber-500 transition"/>
                </label>
                
                {/* User Guide for Web2M */}
                <div className="sm:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
                    <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800/50 text-sm text-blue-800 dark:text-blue-300">
                        <h3 className="font-bold flex items-center gap-2 mb-3">
                            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Hướng dẫn thiết lập Chuyển Khoản Tự Động (Web2M)
                        </h3>
                        <ul className="list-decimal pl-5 space-y-2 opacity-90 marker:text-blue-500 font-medium leading-relaxed">
                            <li>Truy cập trang <a href="https://api.web2m.com/" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 font-black hover:underline">https://api.web2m.com/</a> và tạo tài khoản (Liên hệ đơn vị này nếu cần mua gói).</li>
                            <li>Đăng nhập Internet Banking của bạn vào hệ thống Web2M (để họ đọc lịch sử SMS/Biến động số dư).</li>
                            <li>Vào menu <b className="text-blue-700 dark:text-blue-200">Cấu hình Webhook</b>, click nút <b className="text-blue-700 dark:text-blue-200">Thêm Mới</b>.</li>
                            <li>Tại ô <b>Webhook URL</b>, copy và dán đường link sau: <br/><code className="bg-white dark:bg-slate-900 text-pink-600 px-2 py-1 rounded-md border border-blue-100 dark:border-slate-700 mt-1 tracking-wider inline-block">https://{typeof window !== 'undefined' ? window.location.host : 'datdon.otistx.com'}/api/webhook/web2m</code></li>
                            <li>Ở phần Xác Thực, lấy mã <b className="text-blue-700 dark:text-blue-200">Access Token / Bearer Token</b> mà Web2M cấp cho bạn. Đảm bảo tích chọn Header Authorization.</li>
                            <li>Copy chuỗi Token đó và dán vào ô <b>"Web2M Access Token"</b> bên dưới bảng này, sau đó ấn <b>Lưu thay đổi</b>.</li>
                            <li>XONG! Ngay khi khách chuyển khoản có kèm mã (VD: <i>NGUYEN VAN BANG</i>), hệ thống sẽ tự gạch nợ và cộng tiền trong chưa tới 3 giây!</li>
                        </ul>
                    </div>
                </div>

                {/* Web2M Automated Token */}
                <div className="sm:col-span-2">
                  <label className="block space-y-2 text-sm font-medium">
                      <span className="text-slate-700 dark:text-slate-300 flex items-center gap-2 font-bold uppercase tracking-wider text-xs">
                        <svg className="w-4 h-4 text-emerald-500 shadow-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        Web2M Access Token (Mã Bí Mật)
                      </span>
                      <input type="text" value={config.web2mToken} onChange={e => setConfig({...config, web2mToken: e.target.value})} placeholder="Nhập Token lấy từ cấu hình Webhook..." className="w-full rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/10 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition font-mono"/>
                  </label>
                </div>
            </div>
            
            <div className="pt-4">
                <button type="submit" disabled={saving} className="rounded-xl px-6 py-2.5 bg-amber-600 font-bold text-white shadow hover:bg-amber-700 transition disabled:opacity-50">
                    {saving ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
            </div>
        </form>
    );
}
