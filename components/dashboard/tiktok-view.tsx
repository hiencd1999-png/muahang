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
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
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

      <div className="overflow-x-auto bg-white dark:bg-[#1e1e1e] border border-[#c0c0c0] dark:border-[#444] shadow-sm" style={{ maxHeight: "calc(100vh - 200px)" }}>
        <table className="w-full text-[13px] border-collapse" style={{ fontFamily: "Arial, sans-serif" }}>
          <thead className="bg-[#f8f9fa] dark:bg-[#2d2d2d] text-[#444] dark:text-[#ccc] sticky top-0 z-10 shadow-[0_1px_0_#c0c0c0] dark:shadow-[0_1px_0_#444]">
            <tr>
              <th className="border-r border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-center w-8 bg-[#f8f9fa] dark:bg-[#2d2d2d]">
                <input 
                  type="checkbox" 
                  checked={filteredSessions.length > 0 && filteredSessions.every(s => selectedIds.includes(s.id))}
                  onChange={toggleSelectAllFiltered} 
                  className="accent-blue-600"
                />
              </th>
              <th className="border-r border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-left whitespace-nowrap bg-[#f8f9fa] dark:bg-[#2d2d2d]">Session</th>
              <th className="border-r border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-left whitespace-nowrap bg-[#f8f9fa] dark:bg-[#2d2d2d]">Ghi chú</th>
              <th className="border-r border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-left whitespace-nowrap bg-[#f8f9fa] dark:bg-[#2d2d2d]">Mã Đơn</th>
              <th className="border-r border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-left whitespace-nowrap bg-[#f8f9fa] dark:bg-[#2d2d2d]">Trạng thái</th>
              <th className="border-r border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-left whitespace-nowrap bg-[#f8f9fa] dark:bg-[#2d2d2d]">Tên Shop</th>
              <th className="border-r border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-left whitespace-nowrap bg-[#f8f9fa] dark:bg-[#2d2d2d]">Mã Vận Đơn</th>
              <th className="border-r border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-left whitespace-nowrap bg-[#f8f9fa] dark:bg-[#2d2d2d]">SĐT</th>
              <th className="border-r border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-left whitespace-nowrap min-w-[200px] bg-[#f8f9fa] dark:bg-[#2d2d2d]">Địa chỉ</th>
              <th className="border-r border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-left whitespace-nowrap min-w-[200px] bg-[#f8f9fa] dark:bg-[#2d2d2d]">Sản phẩm</th>
              <th className="border-r border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-right whitespace-nowrap bg-[#f8f9fa] dark:bg-[#2d2d2d]">Tổng tiền</th>
              <th className="border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-center whitespace-nowrap bg-[#f8f9fa] dark:bg-[#2d2d2d]">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} className="text-center p-8 text-[#666] dark:text-[#aaa]">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" />
                </td>
              </tr>
            ) : paginatedSessions.length === 0 ? (
              <tr>
                <td colSpan={12} className="text-center p-8 text-[#666] dark:text-[#aaa] italic">
                  Không có dữ liệu
                </td>
              </tr>
            ) : (
              paginatedSessions.map((session) => {
                const orders = session.filteredOrders;
                const rowCount = Math.max(1, orders.length);
                const isSelected = selectedIds.includes(session.id);
                
                return Array.from({ length: rowCount }).map((_, idx) => {
                  const order = orders[idx];
                  const bgClass = isSelected ? "bg-[#e8f0fe] dark:bg-[#3b5070]" : "bg-white dark:bg-[#1e1e1e] hover:bg-[#f1f3f4] dark:hover:bg-[#2a2a2a]";
                  
                  return (
                    <tr key={`${session.id}-${idx}`} className={`group ${bgClass}`}>
                      {idx === 0 && (
                        <>
                          <td rowSpan={rowCount} className="border-r border-b border-[#c0c0c0] dark:border-[#444] p-1.5 text-center align-top w-8">
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => toggleSelect(session.id)}
                              className="accent-blue-600 mt-1"
                            />
                          </td>
                          <td rowSpan={rowCount} className="border-r border-b border-[#c0c0c0] dark:border-[#444] p-1.5 align-top max-w-[120px]">
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate" title={session.session}>{session.session}</span>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity"><CopyBtn text={session.session} /></div>
                            </div>
                            <div className="mt-1 text-[10px]">
                              {session.isActive ? <span className="text-emerald-600 dark:text-emerald-400 font-bold">Hoạt động</span> : <span className="text-rose-600 dark:text-rose-400 font-bold">Lỗi</span>}
                            </div>
                          </td>
                          <td rowSpan={rowCount} className="border-r border-b border-[#c0c0c0] dark:border-[#444] p-1.5 align-top max-w-[150px]">
                            {editingNoteId === session.id ? (
                              <div className="flex flex-col gap-1">
                                <textarea
                                  value={editingNoteText}
                                  onChange={(e) => setEditingNoteText(e.target.value)}
                                  className="w-full text-xs p-1 border border-[#4d90fe] outline-none resize-none bg-white dark:bg-[#2d2d2d]"
                                  rows={2}
                                  autoFocus
                                  onBlur={() => handleUpdateNote(session.id)}
                                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleUpdateNote(session.id); } if (e.key === 'Escape') setEditingNoteId(null); }}
                                />
                              </div>
                            ) : (
                              <div 
                                className="cursor-text min-h-[20px] text-xs text-[#333] dark:text-[#ccc]" 
                                onClick={() => { setEditingNoteId(session.id); setEditingNoteText(session.note || ""); }}
                              >
                                {session.note || <span className="text-[#999] italic">Trống</span>}
                              </div>
                            )}
                          </td>
                        </>
                      )}

                      {order ? (
                        <>
                          <td className="border-r border-b border-[#c0c0c0] dark:border-[#444] p-1.5">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-mono">{order.orderId}</span>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity"><CopyBtn text={order.orderId} /></div>
                            </div>
                          </td>
                          <td className={`border-r border-b border-[#c0c0c0] dark:border-[#444] p-1.5 whitespace-nowrap ${
                            order.status === "Đã giao" || order.status === "Đã hoàn thành" || order.status?.includes("đã được giao")
                              ? "text-emerald-700 dark:text-emerald-400 font-medium"
                              : order.status === "Đã hủy" || order.status?.includes("hủy")
                                ? "text-rose-700 dark:text-rose-400 font-medium"
                                : "text-amber-700 dark:text-amber-400 font-medium"
                          }`}>
                            {order.status || "-"}
                          </td>
                          <td className="border-r border-b border-[#c0c0c0] dark:border-[#444] p-1.5 truncate max-w-[120px]" title={order.shopName || ""}>
                            {order.shopName || "-"}
                          </td>
                          <td className="border-r border-b border-[#c0c0c0] dark:border-[#444] p-1.5 whitespace-nowrap">
                            <div className="flex items-center justify-between gap-1">
                              <span>{order.trackingNo || "-"}</span>
                              {order.trackingNo && <div className="opacity-0 group-hover:opacity-100 transition-opacity"><CopyBtn text={order.trackingNo} /></div>}
                            </div>
                          </td>
                          <td className="border-r border-b border-[#c0c0c0] dark:border-[#444] p-1.5 whitespace-nowrap">
                            <div className="flex items-center justify-between gap-1">
                              <span>{order.phone || "-"}</span>
                              {order.phone && <div className="opacity-0 group-hover:opacity-100 transition-opacity"><CopyBtn text={order.phone} /></div>}
                            </div>
                          </td>
                          <td className="border-r border-b border-[#c0c0c0] dark:border-[#444] p-1.5">
                            {order.address || "-"}
                          </td>
                          <td className="border-r border-b border-[#c0c0c0] dark:border-[#444] p-1.5">
                            {order.products?.map((p: any, i: number) => (
                              <div key={i} className="mb-0.5 leading-snug" title={p.name}>
                                • {p.name} <strong className="text-blue-600 dark:text-blue-400">(x{p.qty})</strong>
                              </div>
                            ))}
                          </td>
                          <td className="border-r border-b border-[#c0c0c0] dark:border-[#444] p-1.5 text-right font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {order.total || "-"}
                          </td>
                        </>
                      ) : (
                        <td colSpan={8} className="border-r border-b border-[#c0c0c0] dark:border-[#444] p-1.5 text-center text-[#999] italic">
                          Không có đơn hàng
                        </td>
                      )}

                      {idx === 0 && (
                        <td rowSpan={rowCount} className="border-b border-[#c0c0c0] dark:border-[#444] p-1.5 align-top text-center w-20">
                          <div className="flex justify-center gap-2 mt-1">
                            <button 
                              onClick={() => handleSyncSession(session.id)} 
                              disabled={syncingId === session.id}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50" 
                              title="Cập nhật"
                            >
                              <RefreshCw className={`w-4 h-4 ${syncingId === session.id ? 'animate-spin' : ''}`} />
                            </button>
                            <button 
                              onClick={() => handleDeleteSession(session.id)} 
                              className="text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300" 
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                });
              })
            )}
          </tbody>
        </table>
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
