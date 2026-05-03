"use client";

import { useState, useEffect } from "react";
import { Loader2, Trash2, Plus, RefreshCw, MapPin, Phone, Hash, Copy, Check, Edit2, Download, CheckSquare } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
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
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);

  // Copy state
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Edit Note state
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");

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

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

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
      setSelectedIds(prev => prev.filter(s => s !== id));
      fetchSessions();
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  const handleSyncSession = async (id: number, silent = false) => {
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
      if (!silent) addToast("success", "Đã cập nhật đơn hàng thành công");
      await fetchSessions();
    } catch (err: any) {
      if (!silent) addToast("error", err.message);
    } finally {
      setSyncingId(null);
    }
  };

  const handleUpdateNote = async (id: number) => {
    try {
      const res = await fetch("/api/tiktok/session/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, note: editingNoteText }),
      });
      if (!res.ok) throw new Error("Lỗi cập nhật ghi chú");
      addToast("success", "Đã cập nhật ghi chú");
      setEditingNoteId(null);
      fetchSessions();
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  // Bulk Actions
  const toggleSelectAll = () => {
    if (selectedIds.length === sessions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sessions.map(s => s.id));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Xóa ${selectedIds.length} session đã chọn?`)) return;
    
    for (const id of selectedIds) {
      try {
        await fetch("/api/tiktok/session", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
      } catch (e) {}
    }
    addToast("success", `Đã xóa ${selectedIds.length} session`);
    setSelectedIds([]);
    fetchSessions();
  };

  const handleBulkSync = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkSyncing(true);
    addToast("success", `Đang cập nhật ${selectedIds.length} session...`);
    for (const id of selectedIds) {
      await handleSyncSession(id, true);
    }
    setIsBulkSyncing(false);
    addToast("success", `Đã hoàn tất cập nhật`);
  };

  const handleBulkExport = async () => {
    if (selectedIds.length === 0) return;
    setIsExporting(true);
    try {
      const response = await fetch("/api/tiktok/session/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionIds: selectedIds }),
      });

      if (!response.ok) {
        const payload = await response.json();
        addToast("error", payload.error || "Không thể xuất Excel.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tiktok_orders_${Date.now()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      
      addToast("success", "Xuất Excel thành công.");
    } catch {
      addToast("error", "Có lỗi khi xuất Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  const CopyBtn = ({ text }: { text: string | null }) => {
    if (!text) return null;
    const isCopied = copiedText === text;
    return (
      <button 
        onClick={() => handleCopy(text)}
        className="text-slate-400 hover:text-amber-600 transition-colors shrink-0"
        title="Sao chép"
      >
        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    );
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
        <p className="text-xs text-slate-500 mb-4 italic">Cú pháp hỗ trợ: <strong className="text-slate-700 dark:text-slate-300">session|ghi chú</strong>. Mỗi session trên 1 dòng.</p>
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

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="rounded-[1.5rem] border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 shadow-sm sticky top-4 z-10 backdrop-blur-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-amber-900 dark:text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <CheckSquare className="w-4 h-4" /> Đã chọn {selectedIds.length} session
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="rounded-xl border border-amber-200 dark:border-amber-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-400 transition hover:bg-amber-50 dark:hover:bg-amber-800"
              >
                {selectedIds.length === sessions.length ? "Bỏ chọn" : "Chọn tất cả"}
              </button>
              <button
                type="button"
                onClick={handleBulkExport}
                disabled={isExporting}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 hover:bg-emerald-700 transition"
              >
                {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Xuất Excel
              </button>
              <button
                type="button"
                onClick={handleBulkSync}
                disabled={isBulkSyncing}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 hover:bg-blue-700 transition"
              >
                {isBulkSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Cập nhật
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition"
              >
                <Trash2 className="w-3.5 h-3.5" /> Xóa
              </button>
            </div>
          </div>
        </div>
      )}

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
            <div key={session.id} className={`rounded-[1.5rem] border ${selectedIds.includes(session.id) ? 'border-amber-400 dark:border-amber-600 shadow-md ring-1 ring-amber-400/50' : 'border-slate-200 dark:border-slate-700/80 shadow-sm'} bg-white dark:bg-slate-900 overflow-hidden flex flex-col transition-all hover:shadow-xl`}>
              
              {/* Session Header */}
              <div className="bg-slate-50 dark:bg-slate-800/80 p-5 border-b border-slate-100 dark:border-slate-700/80 flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 mr-1" 
                      checked={selectedIds.includes(session.id)}
                      onChange={() => toggleSelect(session.id)}
                    />
                    <div className="flex items-center gap-1">
                      <span className="font-mono bg-white dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs truncate max-w-[200px] md:max-w-[350px] shadow-sm font-bold text-slate-700 dark:text-slate-200">
                        {session.session}
                      </span>
                      <CopyBtn text={session.session} />
                    </div>

                    {/* Editable Note */}
                    {editingNoteId === session.id ? (
                      <div className="flex items-center gap-1">
                        <input 
                          type="text"
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          className="px-2 py-1 text-xs border rounded w-32 md:w-48 outline-none focus:border-blue-500"
                          placeholder="Nhập ghi chú..."
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateNote(session.id); if (e.key === 'Escape') setEditingNoteId(null); }}
                        />
                        <button onClick={() => handleUpdateNote(session.id)} className="p-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 group cursor-pointer" onClick={() => { setEditingNoteId(session.id); setEditingNoteText(session.note || ""); }}>
                        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1 hover:bg-blue-200 transition-colors min-h-[28px]">
                          {session.note ? `📌 ${session.note}` : <span className="opacity-60 italic">Chưa có ghi chú</span>}
                        </span>
                        <Edit2 className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    )}

                    {session.isActive ? (
                      <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">Hoạt động</span>
                    ) : (
                      <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">Lỗi/Hết hạn</span>
                    )}
                  </div>
                  <div className="text-xs font-medium text-slate-500 flex flex-wrap gap-x-4 gap-y-1 ml-6">
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
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-sm font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">#{order.orderId}</span>
                                <CopyBtn text={order.orderId} />
                              </div>
                              <div className={`px-3 py-2 rounded-xl text-xs font-semibold leading-relaxed border ${
                                order.status === "Đã giao" || order.status === "Đã hoàn thành" || order.status?.includes("đã được giao")
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300" 
                                  : order.status === "Đã hủy" || order.status?.includes("hủy")
                                    ? "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-300"
                                    : "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300"
                              }`}>
                                {order.status || "Chờ xử lý"}
                              </div>
                            </div>
                            
                            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] shrink-0">🏪</div>
                              <span className="line-clamp-1">{order.shopName || "Shop không rõ"}</span>
                            </div>
                            
                            <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl inline-block w-full max-w-[250px]">
                              <span className="text-[10px] uppercase font-black tracking-widest text-slate-500 dark:text-slate-400 block mb-0.5">Tổng Tiền</span>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-amber-600 text-lg">{order.total || "-"}</span>
                                <CopyBtn text={order.total} />
                              </div>
                            </div>
                          </div>

                          {/* Info Column 2: Customer details */}
                          <div className="flex-1 min-w-[250px] space-y-3 xl:border-l xl:border-slate-100 xl:dark:border-slate-800 xl:pl-6">
                            <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-2">Thông tin nhận hàng</h4>
                            
                            <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                              <Hash className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                              <div className="flex flex-col w-full">
                                <span className="font-semibold text-slate-800 dark:text-slate-200">Mã Vận Đơn</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{order.trackingNo || "Chưa có mã"}</span>
                                  {order.trackingNo && <CopyBtn text={order.trackingNo} />}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                              <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                              <div className="flex flex-col w-full">
                                <span className="font-semibold text-slate-800 dark:text-slate-200">Số Điện Thoại</span>
                                <div className="flex items-center gap-2">
                                  <span>{order.phone || "Đang cập nhật..."}</span>
                                  {order.phone && <CopyBtn text={order.phone} />}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                              <div className="flex flex-col w-full">
                                <span className="font-semibold text-slate-800 dark:text-slate-200">Địa Chỉ</span>
                                <div className="flex items-start justify-between gap-2">
                                  <span className="line-clamp-2 leading-relaxed">{order.address || "Đang cập nhật..."}</span>
                                  {order.address && <div className="mt-1"><CopyBtn text={order.address} /></div>}
                                </div>
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
                                  <div className="text-right shrink-0 font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded text-xs flex items-center gap-2">
                                    {p.qty}
                                    <CopyBtn text={p.name} />
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
