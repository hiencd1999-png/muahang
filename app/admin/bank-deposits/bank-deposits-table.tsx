"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/shared/toast";
import { Loader2, Check, X } from "lucide-react";

export function BankDepositsTable() {
    const { addToast } = useToast();
    const [status, setStatus] = useState("TRANSFERRED");
    const [deposits, setDeposits] = useState<any[]>([]);
    const [isSpAdmin, setIsSpAdmin] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const fetchDeposits = () => {
        setLoading(true);
        fetch(`/api/admin/bank-deposits?status=${status}`)
            .then(res => res.json())
            .then(data => {
                setDeposits(data.deposits || []);
                setIsSpAdmin(!!data.isSpAdmin);
                setCurrentUserId(data.currentUserId);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchDeposits();
    }, [status]);

    async function handleAction(id: string, action: "APPROVE" | "REJECT") {
        if (!confirm(action === "APPROVE" ? "Xác nhận đã nhận được tiền và cộng số dư cho User?" : "Xác nhận từ chối lệnh nạp tiền này?")) return;
        setProcessingId(id);
        try {
            const res = await fetch(`/api/admin/bank-deposits/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action })
            });
            const data = await res.json();
            if (res.ok) {
                addToast("success", data.message);
                fetchDeposits();
            } else {
                addToast("error", data.error);
            }
        } catch (e) {
            addToast("error", "Lỗi mạng");
        }
        setProcessingId(null);
    }

    return (
        <div className="space-y-4">
            <div className="flex gap-2 text-sm border-b border-slate-200 dark:border-slate-800 pb-2">
                <button onClick={() => setStatus("PENDING")} className={`px-4 py-2 rounded-full font-semibold ${status === "PENDING" ? "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white" : "text-slate-500"}`}>Đang chờ CK</button>
                <button onClick={() => setStatus("TRANSFERRED")} className={`px-4 py-2 rounded-full font-semibold ${status === "TRANSFERRED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" : "text-slate-500"}`}>Đã CK (Cần duyệt)</button>
                <button onClick={() => setStatus("COMPLAINED")} className={`px-4 py-2 rounded-full font-semibold ${status === "COMPLAINED" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" : "text-slate-500"}`}>Khiếu nại</button>
                <button onClick={() => setStatus("COMPLETED")} className={`px-4 py-2 rounded-full font-semibold ${status === "COMPLETED" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" : "text-slate-500"}`}>Hoàn tất</button>
            </div>

            {loading ? (
                <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-amber-500" /></div>
            ) : deposits.length === 0 ? (
                <div className="p-8 text-center text-slate-500">Khong có dữ liệu</div>
            ) : (
                <div className="grid gap-4">
                    {deposits.map(d => {
                        // Logic kiểm tra hiển thị nút thao tác
                        const isOwner = d.adminId === currentUserId;
                        let canEdit = false;
                        if (status === "TRANSFERRED" && isOwner) canEdit = true;
                        if (status === "COMPLAINED" && isSpAdmin) canEdit = true;

                        return (
                        <div key={d.id} className="panel p-5 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between border-l-4 border-l-amber-500">
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                   <span className="font-bold text-slate-900 dark:text-white">{d.user.username}</span>
                                   <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">{d.user.fullName || d.user.phone}</span>
                                </div>
                                <p className="font-mono text-xl font-black text-emerald-600 dark:text-emerald-400">
                                   {new Intl.NumberFormat('vi-VN').format(d.amount)} VNĐ
                                </p>
                                <p className="text-sm text-slate-500">
                                   To Admin: <strong className="text-slate-700 dark:text-slate-300">{d.admin.username}</strong> | Ngày tạo: {new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d.createdAt))}
                                </p>
                                {d.complaintImage && (
                                    <div className="mt-3">
                                        <p className="text-xs uppercase font-bold text-amber-600 mb-2">Ảnh bằng chứng CK:</p>
                                        <a href={d.complaintImage} target="_blank" rel="noreferrer" className="inline-block relative rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700">
                                            <img src={d.complaintImage} alt="CK" className="h-32 object-cover" />
                                        </a>
                                    </div>
                                )}
                            </div>
                            
                            {canEdit && (
                                <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto">
                                    <button 
                                      onClick={() => handleAction(d.id, "APPROVE")} 
                                      disabled={processingId === d.id}
                                      className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-semibold transition active:scale-95 disabled:opacity-50"
                                    >
                                        <Check size={18} /> Đã nhận tiền (Duyệt)
                                    </button>
                                    <button 
                                      onClick={() => handleAction(d.id, "REJECT")} 
                                      disabled={processingId === d.id}
                                      className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl font-semibold transition active:scale-95 disabled:opacity-50"
                                    >
                                        <X size={18} /> Từ chối
                                    </button>
                                </div>
                            )}
                        </div>
                    )})}
                </div>
            )}
        </div>
    );
}
