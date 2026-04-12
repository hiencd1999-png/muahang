"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/shared/toast";
import { Loader2, Power, PowerOff } from "lucide-react";

export function SystemBanksManager() {
    const { addToast } = useToast();
    const [configs, setConfigs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    async function fetchConfigs() {
        try {
            const res = await fetch("/api/admin/system-banks", { cache: "no-store" });
            const data = await res.json();
            if (data.configs) {
                setConfigs(data.configs);
            }
        } catch (e) {
            addToast("error", "Lỗi tải dữ liệu cổng bank");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchConfigs();
    }, []);

    async function toggleActive(id: string, currentStatus: boolean) {
        try {
            // Optimistic update
            setConfigs(prev => prev.map(c => c.id === id ? { ...c, isActive: !currentStatus } : c));
            
            const res = await fetch(`/api/admin/system-banks/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !currentStatus })
            });

            if (!res.ok) {
                throw new Error("Không thể lưu trạng thái");
            }
            addToast("success", `Đã ${!currentStatus ? "MỞ" : "TẮT"} cổng bank thành công`);
        } catch (error: any) {
            addToast("error", error.message);
            // Revert changes
            setConfigs(prev => prev.map(c => c.id === id ? { ...c, isActive: currentStatus } : c));
        }
    }

    if (loading) {
        return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-emerald-500 w-8 h-8" /></div>;
    }

    if (configs.length === 0) {
        return (
            <div className="panel p-10 text-center text-slate-500 dark:text-slate-400 rounded-2xl">
                Chưa có Admin nào thiết lập Cấu hình Cổng Bank.
            </div>
        );
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {configs.map((config) => (
                <div key={config.id} className={`panel rounded-2xl p-5 border-2 transition-all ${config.isActive ? 'border-emerald-500/50 dark:border-emerald-500/30 shadow-emerald-500/10' : 'border-slate-200 dark:border-slate-800 opacity-80'}`}>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {config.admin?.username}
                            </span>
                            <h3 className="font-bold text-lg mt-2 dark:text-white line-clamp-1" title={config.bankName}>{config.bankName.split('-')[0]}</h3>
                        </div>
                        <button 
                            onClick={() => toggleActive(config.id, config.isActive)}
                            className={`p-2 rounded-xl transition shadow-sm ${config.isActive ? 'bg-emerald-100 text-emerald-700 hover:bg-rose-100 hover:text-rose-700 dark:bg-emerald-900/50 dark:text-emerald-400 dark:hover:bg-rose-900/50 dark:hover:text-rose-400' : 'bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-emerald-900/50 dark:hover:text-emerald-400'}`}
                            title={config.isActive ? "Bấm để Tắt Cổng" : "Bấm để Mở Cổng"}
                        >
                            {config.isActive ? <Power size={20} /> : <PowerOff size={20} />}
                        </button>
                    </div>

                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                            <span className="text-slate-500 dark:text-slate-400">Chủ TK:</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{config.accountName}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                            <span className="text-slate-500 dark:text-slate-400">Số TK:</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{config.accountNumber}</span>
                        </div>
                        <div className="pt-1">
                            <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Web2M Status</div>
                            {config.web2mToken ? (
                                <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">Đã liên kết Tự Động</span>
                            ) : (
                                <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Duyệt thủ công</span>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
