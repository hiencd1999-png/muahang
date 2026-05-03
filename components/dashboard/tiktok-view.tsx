"use client";

import { useState, useEffect } from "react";
import { Loader2, Trash2, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { formatDate } from "@/lib/format";
import { useToast } from "@/components/shared/toast";

interface TiktokOrder {
  id: number;
  orderId: string;
  shopName: string | null;
  status: string | null;
  total: string | null;
  products: any;
  updatedAt: string;
}

interface TiktokSession {
  id: number;
  session: string;
  isActive: boolean;
  hasPaid: boolean;
  orders: TiktokOrder[];
  lastRunAt: string | null;
  createdAt: string;
}

export function TiktokView() {
  const [sessions, setSessions] = useState<TiktokSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/tiktok/session");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      setSessions(data);
    } catch (err: any) {
      addToast("error", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleAddSessions = async () => {
    const list = inputText.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    if (!list.length) {
      addToast("error", "Vui lòng nhập ít nhất 1 session");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/tiktok/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessions: list }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add sessions");
      addToast("success", `Đã thêm ${data.addedCount} session mới`);
      setInputText("");
      fetchSessions();
    } catch (err: any) {
      addToast("error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSession = async (id: number) => {
    if (!confirm("Bạn có chắc chắn muốn xóa session này?")) return;
    try {
      const res = await fetch("/api/tiktok/session", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed to delete session");
      addToast("success", "Đã xóa session");
      fetchSessions();
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/80 p-6 shadow-sm">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">Quản lý TikTok</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Quản lý và theo dõi trạng thái đơn hàng TikTok của bạn tự động. 200đ/session cho lần quét đơn thành công đầu tiên.
          </p>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Thêm Session</h3>
        <textarea
          placeholder="9f149a7d7904f342f2aa31c3a21c9e2a&#10;8f249a7d..."
          rows={4}
          className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800 p-4 text-sm outline-none focus:border-amber-500 mb-4"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
        <button
          onClick={handleAddSessions}
          disabled={submitting}
          className="flex items-center gap-2 rounded-2xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60 transition"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Thêm Session
        </button>
      </div>

      <div className="space-y-6">
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>
        ) : sessions.length === 0 ? (
          <div className="text-center p-8 text-sm text-slate-500 rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
            Chưa có session nào.
          </div>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="rounded-[1.5rem] border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-b border-slate-100 dark:border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono bg-white dark:bg-slate-700 px-2 py-1 rounded border border-slate-200 dark:border-slate-600 text-xs truncate max-w-[200px] md:max-w-[400px]">
                      {session.session}
                    </span>
                    {session.isActive ? (
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Hoạt động</span>
                    ) : (
                      <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Lỗi</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    Cập nhật: {session.lastRunAt ? formatDate(new Date(session.lastRunAt)) : "Chưa quét"}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteSession(session.id)}
                  className="flex items-center gap-1 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl text-xs font-semibold transition"
                >
                  <Trash2 className="h-3 w-3" /> Xóa session
                </button>
              </div>

              <div className="p-4 overflow-x-auto">
                {session.orders.length > 0 ? (
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-700/80 text-slate-500">
                        <th className="pb-3 pr-4 font-semibold">Mã ĐH</th>
                        <th className="pb-3 pr-4 font-semibold">Shop</th>
                        <th className="pb-3 pr-4 font-semibold min-w-[200px]">Sản phẩm</th>
                        <th className="pb-3 pr-4 font-semibold">Tổng tiền</th>
                        <th className="pb-3 font-semibold text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {session.orders.map((order) => {
                        const products = order.products as any[] || [];
                        return (
                          <tr key={order.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                            <td className="py-3 pr-4 font-mono text-xs">{order.orderId}</td>
                            <td className="py-3 pr-4">{order.shopName || "-"}</td>
                            <td className="py-3 pr-4 whitespace-normal max-w-[300px]">
                              {products.map((p, i) => (
                                <div key={i} className="text-xs truncate" title={p.name}>
                                  {p.name} <span className="text-slate-400">({p.qty})</span>
                                </div>
                              ))}
                            </td>
                            <td className="py-3 pr-4 font-semibold text-amber-600">{order.total || "-"}</td>
                            <td className="py-3 text-center">
                              <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                                {order.status || "-"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-6 text-sm text-slate-500">
                    Chưa có đơn hàng nào
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
