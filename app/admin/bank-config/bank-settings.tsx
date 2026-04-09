"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/shared/toast";
import { Loader2 } from "lucide-react";

export function AdminBankSettings() {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [config, setConfig] = useState({
        bankName: "",
        accountNumber: "",
        accountName: "",
        branch: "",
        contactInfo: "",
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
                        isActive: data.config.isActive
                    });
                }
            })
            .finally(() => setLoading(false));
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
                    <input required type="text" value={config.bankName} onChange={e => setConfig({...config, bankName: e.target.value})} placeholder="VD: Vietcombank, Techcombank..." className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 outline-none focus:border-amber-500 transition"/>
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
            </div>
            
            <div className="pt-4">
                <button type="submit" disabled={saving} className="rounded-xl px-6 py-2.5 bg-amber-600 font-bold text-white shadow hover:bg-amber-700 transition disabled:opacity-50">
                    {saving ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
            </div>
        </form>
    );
}
