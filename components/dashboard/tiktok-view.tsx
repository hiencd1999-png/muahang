"use client";

import { useState, useEffect } from "react";
import { Loader2, Trash2, Plus, RefreshCw, MapPin, Phone, Hash } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { formatDate } from "@/lib/format";
import { useToast } from "@/components/shared/toast";

interface TiktokOrder {
  id: number;
  orderId: string;
  shopName: string | null;
  status: string | null;
  total: string | null;
  trackingNo: string | null;
  phone: string | null;
  address: string | null;
  products: any;
  updatedAt: string;
}

interface TiktokSession {
  id: number;
  session: string;
  note: string | null;
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
  const [syncingId, setSyncingId] = useState<number | null>(null);
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
      if (!res.ok) throw new Error(data.error || "Lỗi thêm session");
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
      if (!res.ok) throw new Error("Lỗi xóa session");
      addToast("success", "Đã xóa session");
      fetchSessions();
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  const handleSyncSession = async (id: number) => {
    setSyncingId(id);
    try {
      const res = await fetch("/api/tiktok/session/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: id }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Lỗi cập nhật");
      }
      addToast("success", "Đã cập nhật đơn hàng thành công");
      await fetchSessions();
    } catch (err: any) {
      addToast("error", err.message);
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/80 p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">Quản lý Đơn TikTok</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Quản lý và theo dõi trạng thái đơn hàng TikTok tự động. 
              <br className="md:hidden" />
              <span className="font-semibold text-amber-600"> 200đ/session</span> cho lần quét đơn thành công đầu tiên.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Thêm Session Nhanh</h3>
        <p className="text-xs text-slate-500 mb-4 italic">Cú pháp hỗ trợ: session|ghi chú. Mỗi session trên 1 dòng.</p>
        <textarea
          placeholder="9f149a7d7904f342f2aa31c3a21c9e2a|Tài khoản 1&#10;8f249a7d...|Tài khoản 2"
          rows={4}
          className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800 p-4 text-sm outline-none focus:border-amber-500 mb-4 transition-colors font-mono"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
        <button
          onClick={handleAddSessions}
          disabled={submitting}
          className="flex items-center gap-2 rounded-2xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60 transition active:scale-[0.98]"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Thêm Session
        </button>
      </div>

      <div className="space-y-6">
        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center p-10 text-sm text-slate-500 rounded-[1.5rem] border border-slate-200 bg-white shadow-sm flex flex-col items-center gap-3">
            <span className="text-4xl text-slate-300">📦</span>
            Chưa có dữ liệu session nào.
          </div>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="rounded-[1.5rem] border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-lg overflow-hidden flex flex-col transition-all hover:shadow-xl">
              
              {/* Session Header */}
              <div className="bg-slate-50 dark:bg-slate-800/80 p-5 border-b border-slate-100 dark:border-slate-700/80 flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono bg-white dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs truncate max-w-[200px] md:max-w-[350px] shadow-sm font-bold text-slate-700 dark:text-slate-200">
                      {session.session}
                    </span>
                    {session.note && (
                      <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1">
                        📌 {session.note}
                      </span>
                    )}
                    {session.isActive ? (
                      <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">Hoạt động</span>
                    ) : (
                      <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">Lỗi/Hết hạn</span>
                    )}
                  </div>
                  <div className="text-xs font-medium text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                    <span>Lần cập nhật cuối: {session.lastRunAt ? formatDate(new Date(session.lastRunAt)) : "Chưa cập nhật"}</span>
                    <span>•</span>
                    <span>Số đơn: <strong className="text-slate-800 dark:text-slate-200">{session.orders.length}</strong></span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 self-start md:self-auto">
                  <button
                    onClick={() => handleSyncSession(session.id)}
                    disabled={syncingId === session.id}
                    className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${syncingId === session.id ? "animate-spin" : ""}`} /> 
                    {syncingId === session.id ? "Đang cập nhật..." : "Cập nhật"}
                  </button>
                  <button
                    onClick={() => handleDeleteSession(session.id)}
                    className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Xóa
                  </button>
                </div>
              </div>

              {/* Order List */}
              <div className="p-0 overflow-hidden">
                {session.orders.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {session.orders.map((order) => {
                      const products = order.products as any[] || [];
                      return (
                        <div key={order.id} className="p-5 flex flex-col xl:flex-row gap-6 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                          
                          {/* Info Column 1: Order ID & Shop */}
                          <div className="flex-1 min-w-[200px] space-y-3">
                            <div className="flex items-center justify-between xl:justify-start gap-3">
                              <span className="font-mono text-sm font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">#{order.orderId}</span>
                              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                order.status === "Đã giao" || order.status === "Đã hoàn thành" 
                                  ? "bg-emerald-100 text-emerald-700" 
                                  : order.status === "Đã hủy" 
                                    ? "bg-rose-100 text-rose-700"
                                    : "bg-amber-100 text-amber-700"
                              }`}>
                                {order.status || "Chờ xử lý"}
                              </span>
                            </div>
                            
                            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px]">🏪</div>
                              {order.shopName || "Shop không rõ"}
                            </div>
                            
                            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 px-3 py-2 rounded-xl inline-block w-full max-w-[250px]">
                              <span className="text-[10px] uppercase font-black tracking-widest text-amber-700/70 block mb-0.5">Tổng Tiền</span>
                              <span className="font-black text-amber-600 text-lg">{order.total || "-"}</span>
                            </div>
                          </div>

                          {/* Info Column 2: Customer details */}
                          <div className="flex-1 min-w-[250px] space-y-3 xl:border-l xl:border-slate-100 xl:dark:border-slate-800 xl:pl-6">
                            <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-2">Thông tin nhận hàng</h4>
                            
                            <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                              <Hash className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-800 dark:text-slate-200">Mã Vận Đơn</span>
                                <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{order.trackingNo || "Chưa có mã"}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                              <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-800 dark:text-slate-200">Số Điện Thoại</span>
                                <span>{order.phone || "Đang cập nhật..."}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-800 dark:text-slate-200">Địa Chỉ</span>
                                <span className="line-clamp-2 leading-relaxed">{order.address || "Đang cập nhật..."}</span>
                              </div>
                            </div>
                          </div>

                          {/* Info Column 3: Products */}
                          <div className="flex-[1.5] min-w-[250px] space-y-3 xl:border-l xl:border-slate-100 xl:dark:border-slate-800 xl:pl-6">
                            <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-2">Sản phẩm ({products.length})</h4>
                            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                              {products.length > 0 ? products.map((p, i) => (
                                <div key={i} className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700/50 flex gap-3 text-sm items-start">
                                  <div className="flex-1 font-medium text-slate-700 dark:text-slate-200 line-clamp-2 leading-snug" title={p.name}>
                                    {p.name}
                                  </div>
                                  <div className="text-right shrink-0 font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded text-xs">
                                    {p.qty}
                                  </div>
                                </div>
                              )) : (
                                <div className="text-xs text-slate-500 italic">Không tìm thấy thông tin sản phẩm</div>
                              )}
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10 text-sm text-slate-500 font-medium">
                    Chưa có đơn hàng nào cho session này. Nhấn "Cập nhật" để thử tải lại.
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
