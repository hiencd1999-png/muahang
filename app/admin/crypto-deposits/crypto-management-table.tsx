"use client";

import { useState, useEffect } from "react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Check, X, Loader2, RefreshCcw } from "lucide-react";
import { useToast } from "@/components/shared/toast";

export function CryptoManagementTable() {
    const { addToast } = useToast();
    const [deposits, setDeposits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState<string | null>(null);

    const fetchDeposits = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/crypto-deposits");
            if (res.ok) {
                setDeposits(await res.json());
            }
        } catch (e) {}
        setLoading(false);
    };

    useEffect(() => {
        fetchDeposits();
    }, []);

    const handleAction = async (id: string, action: "APPROVE" | "REJECT") => {
        if (!confirm(`Bạn chắc chắn muốn ${action === "APPROVE" ? "DUYỆT" : "TỪ CHỐI"} đơn nạp này?`)) return;
        
        setActionId(id);
        try {
            const res = await fetch(`/api/admin/crypto-deposits/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action })
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || "Có lỗi xảy ra");

            addToast("success", data.message || "Xử lý thành công!");
            await fetchDeposits();
        } catch (err: any) {
            addToast("error", err.message);
        } finally {
            setActionId(null);
        }
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-amber-500" /></div>;

    const getStatusStyle = (status: string) => {
        switch (status) {
            case "PENDING": return "bg-amber-100 text-amber-700";
            case "COMPLETED": return "bg-emerald-100 text-emerald-700";
            case "REJECTED": return "bg-rose-100 text-rose-700";
            case "EXPIRED": return "bg-slate-100 text-slate-700";
            default: return "bg-slate-100 text-slate-700";
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case "PENDING": return "Chờ chuyển";
            case "COMPLETED": return "Đã hoàn thành";
            case "REJECTED": return "Từ chối";
            case "EXPIRED": return "Quá hạn/Hủy";
            default: return status;
        }
    };

    return (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">Danh sách lệnh nạp Crypto</h3>
                <button onClick={fetchDeposits} className="text-slate-500 hover:text-amber-500 transition"><RefreshCcw size={18} /></button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50">
                        <tr>
                            <th className="px-6 py-4 whitespace-nowrap">Mã đơn</th>
                            <th className="px-6 py-4 whitespace-nowrap">Khách hàng</th>
                            <th className="px-6 py-4 whitespace-nowrap">Số lượng</th>
                            <th className="px-6 py-4 whitespace-nowrap">Mạng lưới</th>
                            <th className="px-6 py-4 whitespace-nowrap">Quy đổi VNĐ</th>
                            <th className="px-6 py-4 whitespace-nowrap">Thời gian</th>
                            <th className="px-6 py-4 whitespace-nowrap text-center">Trạng thái</th>
                            <th className="px-6 py-4 whitespace-nowrap text-right">Hành động</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {deposits.map(d => (
                            <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                                <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-slate-500">
                                    {d.id.split('-')[0]}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap font-semibold text-slate-900 dark:text-white">
                                    @{d.user.username}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap font-bold text-amber-600">
                                    {d.amount} USDT <span className="text-xs font-mono text-amber-500/80 ml-1 font-normal">(Lẻ: {d.expectedAmount})</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-xs uppercase tracking-wider text-slate-500 font-medium">
                                    {d.network}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap font-semibold text-emerald-600">
                                    {formatCurrency(d.amount * 25500)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-slate-900 dark:text-slate-200">
                                    {formatDate(d.createdAt)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold leading-none ${getStatusStyle(d.status)}`}>
                                        {getStatusText(d.status)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                    {d.status === "PENDING" && (
                                        <div className="flex justify-end gap-2">
                                            <button 
                                                disabled={actionId === d.id}
                                                onClick={() => handleAction(d.id, "REJECT")}
                                                className="inline-flex items-center justify-center rounded-lg bg-rose-100 p-2 text-rose-600 transition hover:bg-rose-200 active:scale-95 disabled:opacity-50"
                                            >
                                                <X size={16} />
                                            </button>
                                            <button 
                                                disabled={actionId === d.id}
                                                onClick={() => handleAction(d.id, "APPROVE")}
                                                className="inline-flex items-center justify-center rounded-lg bg-emerald-100 p-2 text-emerald-600 transition hover:bg-emerald-200 active:scale-95 disabled:opacity-50"
                                            >
                                                <Check size={16} />
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {deposits.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                                    Không có giao dịch USDT nào
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
