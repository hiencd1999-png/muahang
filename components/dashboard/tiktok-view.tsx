"use client";

import { useState, useEffect } from "react";
import { Loader2, Trash2, Plus, RefreshCw, MapPin, Phone, Hash, Copy, Check, Edit2, Download, CheckSquare, Search, ChevronLeft, ChevronRight, Truck } from "lucide-react";
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
  details?: any;
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

  // Expand Session state
  const [expandedSessions, setExpandedSessions] = useState<Set<number>>(new Set());

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

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

  const toggleExpandSession = (sessionId: number) => {
    setExpandedSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) newSet.delete(sessionId);
      else newSet.add(sessionId);
      return newSet;
    });
  };

  // Derived values for filters
  const allStatuses = Array.from(new Set(sessions.flatMap(s => s.orders.map(o => o.status || "Chờ xử lý")))).filter(Boolean).sort();

  // Filter & Pagination Logic
  const filteredSessions = sessions.map(session => {
    const q = searchQuery.toLowerCase();
    
    // Filter orders
    const filteredOrders = session.orders.filter(order => {
      const matchStatus = statusFilter === "ALL" || (order.status || "Chờ xử lý") === statusFilter;
      const matchSearch = !q || 
        order.orderId.toLowerCase().includes(q) ||
        (order.trackingNo || "").toLowerCase().includes(q) ||
        (order.phone || "").toLowerCase().includes(q) ||
        (order.shopName || "").toLowerCase().includes(q) ||
        (order.address || "").toLowerCase().includes(q) ||
        ((order.products as any[]) || []).some(p => p.name.toLowerCase().includes(q));
      
      return matchStatus && matchSearch;
    });

    const sessionMatchSearch = !q || 
      session.session.toLowerCase().includes(q) || 
      (session.note || "").toLowerCase().includes(q);

    // If a specific status is selected, the session MUST have matching orders
    const matchStatusRequirement = statusFilter === "ALL" || filteredOrders.length > 0;

    return {
      ...session,
      filteredOrders,
      isMatch: (sessionMatchSearch || filteredOrders.length > 0) && matchStatusRequirement
    };
  }).filter(s => s.isMatch);

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / itemsPerPage));
  const paginatedSessions = filteredSessions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, itemsPerPage]);

  // Bulk Actions
  const toggleSelectAllFiltered = () => {
    const filteredIds = filteredSessions.map(s => s.id);
    const allSelected = filteredIds.every(id => selectedIds.includes(id));
    
    if (allSelected) {
      // Deselect all filtered
      setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      // Select all filtered
      setSelectedIds(prev => {
        const newSet = new Set([...prev, ...filteredIds]);
        return Array.from(newSet);
      });
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
        <div className="flex flex-col md:flex-row md:items-start justify-between mb-3 gap-3">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white shrink-0">Thêm Session Nhanh</h3>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 text-blue-800 dark:text-blue-300 px-4 py-2.5 rounded-xl text-xs flex items-start gap-2 max-w-2xl leading-relaxed">
            <span className="text-blue-500 mt-0.5">💡</span>
            <span>
              <strong>Cách lấy Session:</strong> Đăng nhập vào Seller Center trên máy tính, nhấn <strong>F12</strong> (hoặc chuột phải chọn Kiểm tra), chuyển sang tab <strong>Application</strong> {'>'} <strong>Cookies</strong> và copy giá trị của <code>session_ss</code>.
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-4 italic">Cú pháp hỗ trợ: <strong className="text-slate-700 dark:text-slate-300">session_ss|ghi chú</strong>. Mỗi session trên 1 dòng.</p>
        <textarea
          placeholder="9f149a7d7904f342f2aa31c3a21c9e2a|Tài khoản 1&#10;8f249a7d...|Tài khoản 2"
          rows={3}
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

      {/* Tools & Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-[1.5rem] border border-slate-200 dark:border-slate-700/80 shadow-sm">
        <div className="flex-1 flex flex-col sm:flex-row gap-3 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm mã đơn, SĐT, session..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-amber-500 transition-colors"
            />
          </div>
          <select 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-amber-500 transition-colors min-w-[180px]"
          >
            <option value="ALL">Tất cả trạng thái</option>
            {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        
        <div className="flex items-center justify-between sm:justify-end gap-3 w-full md:w-auto">
          <button
            onClick={toggleSelectAllFiltered}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold transition-colors"
          >
            Chọn tất cả
          </button>
          <select 
            value={itemsPerPage}
            onChange={e => setItemsPerPage(Number(e.target.value))}
            className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-amber-500 transition-colors"
          >
            <option value={10}>10 dòng</option>
            <option value={20}>20 dòng</option>
            <option value={50}>50 dòng</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="rounded-[1.5rem] border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 shadow-sm sticky top-4 z-10 backdrop-blur-sm animate-in fade-in slide-in-from-top-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-amber-900 dark:text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <CheckSquare className="w-4 h-4" /> Đã chọn {selectedIds.length} session
            </p>
            <div className="flex flex-wrap items-center gap-2">
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
        ) : paginatedSessions.length === 0 ? (
          <div className="text-center p-10 text-sm text-slate-500 rounded-[1.5rem] border border-slate-200 bg-white shadow-sm flex flex-col items-center gap-3">
            <span className="text-4xl text-slate-300">📦</span>
            Không tìm thấy session nào khớp với điều kiện lọc.
          </div>
        ) : (
          paginatedSessions.map((session) => (
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
                    <span>Tổng đơn: <strong className="text-slate-800 dark:text-slate-200">{session.orders.length}</strong></span>
                    {session.filteredOrders.length !== session.orders.length && (
                      <span>•</span>
                    )}
                    {session.filteredOrders.length !== session.orders.length && (
                      <span className="text-amber-600 font-bold">Khớp lọc: {session.filteredOrders.length}</span>
                    )}
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
                {session.filteredOrders.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {(() => {
                      const sortedOrders = [...session.filteredOrders].sort((a, b) => {
                        if (a.orderId.length !== b.orderId.length) return b.orderId.length - a.orderId.length;
                        return b.orderId.localeCompare(a.orderId);
                      });
                      const isExpanded = expandedSessions.has(session.id);
                      const displayedOrders = isExpanded ? sortedOrders : sortedOrders.slice(0, 1);
                      
                      return (
                        <>
                          {displayedOrders.map((order) => {
                            const products = order.products as any[] || [];
                            
                            // Safely parse details
                            let parsedDetails = order.details;
                            if (typeof parsedDetails === 'string') {
                              try { parsedDetails = JSON.parse(parsedDetails); } catch (e) {}
                            }
                            
                            const shipperName = parsedDetails?.detail?.shipper_name || parsedDetails?.shipper_name;
                            const shipperPhone = parsedDetails?.detail?.shipper_phone || parsedDetails?.shipper_phone;

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

                                  {(shipperName || shipperPhone) && (
                                    <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300 mt-4 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                                      <Truck className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                                      <div className="flex flex-col w-full">
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">Người Giao Hàng</span>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          <span>
                                            {shipperName || "Không rõ tên"}
                                            {shipperPhone ? ` - ${shipperPhone}` : ""}
                                          </span>
                                          {shipperPhone && <CopyBtn text={shipperPhone} />}
                                        </div>
                                      </div>
                                    </div>
                                  )}
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
                          
                          {sortedOrders.length > 1 && (
                            <div className="bg-slate-50/50 dark:bg-slate-800/30 p-2 flex justify-center border-t border-slate-100 dark:border-slate-700/50">
                              <button 
                                onClick={() => toggleExpandSession(session.id)}
                                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-amber-600 bg-white hover:bg-amber-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-amber-900/30 dark:hover:text-amber-400 border border-slate-200 dark:border-slate-700 rounded-full transition-colors shadow-sm"
                              >
                                {isExpanded ? (
                                  <>Thu gọn <span className="text-[10px]">▲</span></>
                                ) : (
                                  <>Xem thêm {sortedOrders.length - 1} đơn hàng <span className="text-[10px]">▼</span></>
                                )}
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
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

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-4">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-1 px-2">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Trang {currentPage}</span>
            <span className="text-sm text-slate-500">/ {totalPages}</span>
          </div>

          <button 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </section>
  );
}
