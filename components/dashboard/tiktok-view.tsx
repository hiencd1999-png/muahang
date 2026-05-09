"use client";

import { useState, useEffect } from "react";
import { Loader2, Trash2, Plus, RefreshCw, MapPin, Phone, Hash, Copy, Check, Edit2, Download, CheckSquare, Search, ChevronLeft, ChevronRight, Truck, Maximize, Minimize } from "lucide-react";
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

const TiktokUserInfo = ({ sessionStr }: { sessionStr: string }) => {
  const [info, setInfo] = useState<{ username?: string, user_id?: string, error?: boolean } | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch(`/api/tiktok/session/info?session=${encodeURIComponent(sessionStr)}`)
      .then(res => res.json())
      .then(data => {
        if (mounted) {
          if (data.ok && data.summary) {
            setInfo({ username: data.summary.username, user_id: data.summary.user_id });
          } else {
            setInfo({ error: true });
          }
        }
      })
      .catch(() => {
        if (mounted) setInfo({ error: true });
      });
    return () => { mounted = false; };
  }, [sessionStr]);

  if (!info) return <Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-400" />;
  if (info.error) return <span className="text-xs text-rose-500 font-medium">Lỗi tải</span>;
  
  return (
    <div className="flex flex-col items-center gap-1 text-xs whitespace-nowrap">
      <span className="font-bold text-slate-800 dark:text-slate-200">{info.username}</span>
      <span className="text-slate-500 font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">{info.user_id}</span>
    </div>
  );
};

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Auto Sync State
  const [isAutoSync, setIsAutoSync] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("tiktokAutoSync");
      return saved === "true";
    }
    return false;
  });
  const [autoSyncCountdown, setAutoSyncCountdown] = useState(300);

  const toggleAutoSync = () => {
    setIsAutoSync(prev => {
      const newState = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("tiktokAutoSync", String(newState));
      }
      return newState;
    });
  };

  // Column Resizing State
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  const startResize = (e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    setResizingCol(colId);
    setStartX(e.clientX);
    const th = (e.target as HTMLElement).closest('th');
    setStartWidth(th ? th.getBoundingClientRect().width : 100);
  };

  useEffect(() => {
    if (!resizingCol) return;
    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX;
      setColWidths(prev => ({
        ...prev,
        [resizingCol]: Math.max(30, startWidth + diff) // Minimum width of 30px
      }));
    };
    const handleMouseUp = () => setResizingCol(null);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol, startX, startWidth]);

  // Check URL for fullscreen mode on load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('fullscreen') === 'true') {
        setIsFullscreen(true);
      }
    }
  }, []);

  const handleCloseFullscreen = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('fullscreen') === 'true') {
        window.close(); // Close the tab if it was opened dedicatedly for fullscreen
      } else {
        setIsFullscreen(false);
      }
    } else {
      setIsFullscreen(false);
    }
  };

  const openFullscreenInNewTab = () => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('fullscreen', 'true');
      window.open(url.toString(), '_blank');
    }
  };

  // Handle Escape key to close fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        handleCloseFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

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

  const handleSyncSession = async (id: number, silent = false, skipFetch = false) => {
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
      if (!skipFetch) await fetchSessions();
      return true;
    } catch (err: any) {
      if (!silent) addToast("error", err.message);
      return false;
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

  const handleCopyCard = (session: TiktokSession & { filteredOrders: any[] }) => {
    const ordersText = session.filteredOrders.map(order => {
      let parsedDetails = order.details;
      if (typeof parsedDetails === 'string') {
        try { parsedDetails = JSON.parse(parsedDetails); } catch (e) {}
      }
      const recipientName = parsedDetails?.detail?.recipient?.name || parsedDetails?.recipient?.name || "";
      const recipientPhone = order.phone || parsedDetails?.detail?.recipient?.phone || parsedDetails?.recipient?.phone || "";
      const address = order.address || parsedDetails?.detail?.recipient?.address || parsedDetails?.recipient?.address || "";
      
      const products = Array.isArray(order.products) ? order.products : [];
      let productText = products.map((p: any) => `📦 ${p.name}  •  💰 ${p.price || ""}`).join("\n");
      if (!productText) productText = "📦 Không rõ sản phẩm";
      
      const carrier = parsedDetails?.detail?.logistics?.carrier || parsedDetails?.logistics?.carrier || "";
      const trackingNo = order.trackingNo || parsedDetails?.detail?.logistics?.tracking_no || parsedDetails?.logistics?.tracking_no || "";
      let logisticsState = parsedDetails?.detail?.logistics?.state || parsedDetails?.logistics?.state || order.status || "";
      if (parsedDetails?.detail?.logistics?.message) {
        logisticsState += ` - ${parsedDetails.detail.logistics.message.split('\n')[0]}`;
      }

      const shipperName = parsedDetails?.detail?.shipper_name || parsedDetails?.shipper_name || "";
      let rawShipperPhone = parsedDetails?.detail?.shipper_phone || parsedDetails?.shipper_phone || "";
      const shipperPhone = rawShipperPhone ? rawShipperPhone.split(/Hotline/i)[0].trim() : "";
      
      const lines: string[] = [];
      lines.push("ℹ️ THÔNG TIN");
      if (recipientName) lines.push(`👤 Người nhận: ${recipientName}`);
      if (recipientPhone) lines.push(`📞 SĐT nhận: ${recipientPhone}`);
      if (address) lines.push(`🏠 Địa chỉ: ${address}`);
      lines.push(productText);
      
      const logisticsLines: string[] = [];
      if (carrier) logisticsLines.push(`🏢 ${carrier}`);
      if (trackingNo) logisticsLines.push(`🆔 ${trackingNo}`);
      if (logisticsState) logisticsLines.push(`📍 ${logisticsState}`);
      if (shipperName) logisticsLines.push(`🛵 Shipper: ${shipperName}${shipperPhone ? ` - ${shipperPhone}` : ""}`);

      if (logisticsLines.length > 0) {
        lines.push("──────────────");
        lines.push("🚚 VẬN CHUYỂN");
        lines.push(...logisticsLines);
      }
      
      return lines.join("\n");
    }).join("\n\n====================\n\n");

    if (!ordersText) {
      addToast("error", "Không có đơn hàng nào để copy");
      return;
    }
    
    navigator.clipboard.writeText(ordersText);
    addToast("success", "Đã copy thông tin thẻ");
  };

  // Derived values for filters
  const allStatuses = Array.from(new Set(sessions.flatMap(s => s.orders.map(o => o.status || "Chờ xử lý")))).filter(Boolean).sort();

  // Filter & Pagination Logic
  const filteredSessions = sessions.map(session => {
    const q = searchQuery.toLowerCase();
    
    const sessionMatchSearch = !q || 
      session.session.toLowerCase().includes(q) || 
      (session.note || "").toLowerCase().includes(q);

    // Filter orders
    let filteredOrders = session.orders.filter(order => {
      let orderTs: number | null = null;
      let parsedDetails = order.details;
      if (typeof parsedDetails === 'string') {
        try { parsedDetails = JSON.parse(parsedDetails); } catch (e) {}
      }
      const orderedAt = parsedDetails?.detail?.timeline?.ordered_at || parsedDetails?.timeline?.ordered_at;
      const ts = parsedDetails?.detail?.create_time || parsedDetails?.create_time;
      
      if (orderedAt) {
        try {
          const match = orderedAt.match(/(\d{1,2}):(\d{2})\s*(SA|CH|AM|PM)?,\s*(\d{1,2})\s*(?:tháng|-|\/)\s*(\d{1,2})\s*(?:năm|-|\/)?\s*(\d{4})?/i);
          if (match) {
            let [_, h, m, ampm, D, M, Y] = match;
            let hour = parseInt(h);
            const min = parseInt(m);
            if (ampm && (ampm.toUpperCase() === 'CH' || ampm.toUpperCase() === 'PM') && hour < 12) hour += 12;
            if (ampm && (ampm.toUpperCase() === 'SA' || ampm.toUpperCase() === 'AM') && hour === 12) hour = 0;
            orderTs = new Date(Y ? parseInt(Y) : new Date().getFullYear(), parseInt(M) - 1, parseInt(D), hour, min).getTime();
          }
        } catch (e) {}
      }

      if (!orderTs && ts) {
        orderTs = typeof ts === 'number' ? (ts < 1e12 ? ts * 1000 : ts) : new Date(ts).getTime();
      } else if (!orderTs && order.updatedAt) {
        orderTs = new Date(order.updatedAt).getTime();
      }

      let matchDate = true;
      if (orderTs) {
        if (startDate) {
          const startTs = new Date(startDate).getTime();
          if (orderTs < startTs) matchDate = false;
        }
        if (endDate) {
          const endTs = new Date(endDate).getTime();
          if (orderTs > endTs) matchDate = false;
        }
      } else if (startDate || endDate) {
        matchDate = false;
      }

      const matchStatus = statusFilter === "ALL" || (order.status || "Chờ xử lý") === statusFilter;
      
      const matchOrderSearch = !q || 
        order.orderId.toLowerCase().includes(q) ||
        (order.trackingNo || "").toLowerCase().includes(q) ||
        (order.phone || "").toLowerCase().includes(q) ||
        (order.shopName || "").toLowerCase().includes(q) ||
        (order.address || "").toLowerCase().includes(q) ||
        ((order.products as any[]) || []).some(p => p.name.toLowerCase().includes(q));
      
      // If the session itself matched the search query, we show the order (as long as it matches the status filter and date)
      return matchDate && matchStatus && (sessionMatchSearch || matchOrderSearch);
    });

    // Nếu 1 session có cả đơn hủy và không hủy thì chỉ hiển thị đơn không bị hủy
    const hasNonCanceled = filteredOrders.some(o => !(o.status === "Đã hủy" || o.status?.toLowerCase().includes("hủy")));
    const hasCanceled = filteredOrders.some(o => o.status === "Đã hủy" || o.status?.toLowerCase().includes("hủy"));

    if (hasNonCanceled && hasCanceled) {
      filteredOrders = filteredOrders.filter(o => !(o.status === "Đã hủy" || o.status?.toLowerCase().includes("hủy")));
    }

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
  }, [searchQuery, statusFilter, itemsPerPage, startDate, endDate]);

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
    addToast("success", `Đang cập nhật đồng thời ${selectedIds.length} session...`);
    
    const results = await Promise.all(selectedIds.map(id => handleSyncSession(id, true, true)));
    
    let successCount = 0;
    let errorCount = 0;
    results.forEach(success => {
      if (success) successCount++;
      else errorCount++;
    });

    await fetchSessions();
    setIsBulkSyncing(false);

    if (errorCount > 0) {
      addToast("error", `Cập nhật xong: ${successCount} thành công, ${errorCount} thất bại`);
    } else {
      addToast("success", `Hoàn tất cập nhật ${successCount} session`);
    }
  };

  const handleAutoSync = async () => {
    setIsBulkSyncing(true);
    const activeSessions = sessions.filter(s => s.isActive);
    if (activeSessions.length > 0) {
      addToast("success", `Auto Sync: Đang cập nhật ${activeSessions.length} session...`);
      await Promise.all(activeSessions.map(s => handleSyncSession(s.id, true, true)));
      await fetchSessions();
      setIsBulkSyncing(false);
      addToast("success", "Auto Sync: Hoàn tất cập nhật");
    } else {
      setIsBulkSyncing(false);
    }
  };

  useEffect(() => {
    let countdown: NodeJS.Timeout;

    if (isAutoSync) {
      countdown = setInterval(() => {
        setAutoSyncCountdown((prev) => {
          if (prev <= 1) {
            handleAutoSync();
            return 300;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setAutoSyncCountdown(300);
    }

    return () => {
      if (countdown) clearInterval(countdown);
    };
  }, [isAutoSync, sessions]);


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
              <span className="font-semibold text-amber-600"> 500đ/session</span> cho lần quét đơn thành công đầu tiên.
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

      {/* Fullscreen Wrapper */}
      <div className={isFullscreen ? "fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-950 p-2 sm:p-4 flex flex-col overflow-hidden" : "space-y-6"}>
        
        {/* Fullscreen Header (only visible in fullscreen) */}
        {isFullscreen && (
          <div className="flex items-center justify-between mb-4 px-2 shrink-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-2xl">📊</span> Bảng dữ liệu toàn màn hình
            </h2>
            <button 
              onClick={handleCloseFullscreen}
              className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-semibold transition"
            >
              <Minimize className="w-4 h-4" /> Đóng (Esc)
            </button>
          </div>
        )}

        {/* Tools & Filters */}
        <div className={`flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-[1.5rem] border border-slate-200 dark:border-slate-700/80 shadow-sm shrink-0 overflow-hidden ${isFullscreen ? 'mb-4' : ''}`}>
          <div className="flex-1 flex flex-wrap gap-3 w-full items-center">
            <div className="relative flex-auto min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Tìm mã đơn, SĐT, session..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <input 
                type="datetime-local" 
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-amber-500 transition-colors w-full sm:w-auto"
                title="Từ ngày"
              />
              <span className="text-slate-400 hidden sm:inline">-</span>
              <input 
                type="datetime-local" 
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-amber-500 transition-colors w-full sm:w-auto"
                title="Đến ngày"
              />
            </div>
            <select 
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-amber-500 transition-colors min-w-[150px] flex-auto sm:flex-none"
            >
              <option value="ALL">Tất cả trạng thái</option>
              {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          
          <div className="flex flex-wrap items-center justify-start xl:justify-end gap-2 w-full xl:w-auto">
            <button
              onClick={toggleSelectAllFiltered}
              className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              Chọn tất cả
            </button>
            <select 
              value={itemsPerPage}
              onChange={e => setItemsPerPage(Number(e.target.value))}
              className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-amber-500 transition-colors"
            >
              <option value={10}>10 dòng</option>
              <option value={20}>20 dòng</option>
              <option value={50}>50 dòng</option>
              <option value={100}>100 dòng</option>
              <option value={1000}>1000 dòng</option>
            </select>
            <button
              onClick={toggleAutoSync}
              className={`px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${isAutoSync ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
              title="Tự động đồng bộ các Session đang hoạt động mỗi 5 phút"
            >
              <RefreshCw className={`w-4 h-4 ${isAutoSync ? 'animate-spin' : ''}`} style={isAutoSync ? { animationDuration: '3s' } : {}} />
              {isAutoSync ? `Auto Sync (${Math.floor(autoSyncCountdown / 60)}:${String(autoSyncCountdown % 60).padStart(2, '0')})` : 'Auto Sync (Tắt)'}
            </button>
            {!isFullscreen && (
              <button
                onClick={openFullscreenInNewTab}
                className="p-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 rounded-xl transition-colors shrink-0"
                title="Mở toàn màn hình ở tab mới"
              >
                <Maximize className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.length > 0 && (
          <div className="rounded-[1.5rem] border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 shadow-sm shrink-0 mb-4 animate-in fade-in slide-in-from-top-4">
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

        <div className={`overflow-x-auto bg-white dark:bg-[#1e1e1e] border border-[#c0c0c0] dark:border-[#444] shadow-sm custom-scrollbar hidden xl:block ${isFullscreen ? 'flex-1 h-0' : ''}`} style={!isFullscreen ? { maxHeight: "calc(100vh - 200px)" } : {}}>
        <table className={`w-full text-[13px] border-collapse ${resizingCol ? 'select-none cursor-col-resize' : ''}`} style={{ fontFamily: "Arial, sans-serif" }}>
          <thead className="bg-[#f8f9fa] dark:bg-[#2d2d2d] text-[#444] dark:text-[#ccc] sticky top-0 z-10 shadow-[0_1px_0_#c0c0c0] dark:shadow-[0_1px_0_#444]">
            <tr>
              <th style={{ width: colWidths['cb'] || 32, minWidth: colWidths['cb'] || 32, maxWidth: colWidths['cb'] || 32 }} className="relative border-r border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-center bg-[#f8f9fa] dark:bg-[#2d2d2d]">
                <input 
                  type="checkbox" 
                  checked={filteredSessions.length > 0 && filteredSessions.every(s => selectedIds.includes(s.id))}
                  onChange={toggleSelectAllFiltered} 
                  className="accent-blue-600"
                />
                <div className={`absolute right-0 top-0 w-1 h-full cursor-col-resize z-20 ${resizingCol === 'cb' ? 'bg-blue-500' : 'hover:bg-blue-300'}`} onMouseDown={(e) => startResize(e, 'cb')} />
              </th>
              <th style={{ width: colWidths['actions'], minWidth: colWidths['actions'], maxWidth: colWidths['actions'] }} className="relative border-r border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-center whitespace-nowrap bg-[#f8f9fa] dark:bg-[#2d2d2d]">
                Thao tác
              </th>
              <th style={{ width: colWidths['session'], minWidth: colWidths['session'], maxWidth: colWidths['session'] }} className="relative border-r border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-center whitespace-nowrap bg-[#f8f9fa] dark:bg-[#2d2d2d]">
                Session <div className={`absolute right-0 top-0 w-1 h-full cursor-col-resize z-20 ${resizingCol === 'session' ? 'bg-blue-500' : 'hover:bg-blue-300'}`} onMouseDown={(e) => startResize(e, 'session')} />
              </th>
              <th style={{ width: colWidths['account'], minWidth: colWidths['account'], maxWidth: colWidths['account'] }} className="relative border-r border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-center whitespace-nowrap bg-[#f8f9fa] dark:bg-[#2d2d2d]">
                Tài khoản <div className={`absolute right-0 top-0 w-1 h-full cursor-col-resize z-20 ${resizingCol === 'account' ? 'bg-blue-500' : 'hover:bg-blue-300'}`} onMouseDown={(e) => startResize(e, 'account')} />
              </th>
              <th style={{ width: colWidths['note'], minWidth: colWidths['note'], maxWidth: colWidths['note'] }} className="relative border-r border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-center whitespace-nowrap bg-[#f8f9fa] dark:bg-[#2d2d2d]">
                Ghi chú <div className={`absolute right-0 top-0 w-1 h-full cursor-col-resize z-20 ${resizingCol === 'note' ? 'bg-blue-500' : 'hover:bg-blue-300'}`} onMouseDown={(e) => startResize(e, 'note')} />
              </th>
              <th style={{ width: colWidths['orderId'], minWidth: colWidths['orderId'], maxWidth: colWidths['orderId'] }} className="relative border-r border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-center whitespace-nowrap bg-[#f8f9fa] dark:bg-[#2d2d2d]">
                Mã Đơn <div className={`absolute right-0 top-0 w-1 h-full cursor-col-resize z-20 ${resizingCol === 'orderId' ? 'bg-blue-500' : 'hover:bg-blue-300'}`} onMouseDown={(e) => startResize(e, 'orderId')} />
              </th>
              <th style={{ width: colWidths['orderTime'], minWidth: colWidths['orderTime'], maxWidth: colWidths['orderTime'] }} className="relative border-r border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-center whitespace-nowrap bg-[#f8f9fa] dark:bg-[#2d2d2d]">
                Thời gian đặt <div className={`absolute right-0 top-0 w-1 h-full cursor-col-resize z-20 ${resizingCol === 'orderTime' ? 'bg-blue-500' : 'hover:bg-blue-300'}`} onMouseDown={(e) => startResize(e, 'orderTime')} />
              </th>
              <th style={{ width: colWidths['shopName'], minWidth: colWidths['shopName'], maxWidth: colWidths['shopName'] }} className="relative border-r border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-center whitespace-nowrap bg-[#f8f9fa] dark:bg-[#2d2d2d]">
                Tên shop <div className={`absolute right-0 top-0 w-1 h-full cursor-col-resize z-20 ${resizingCol === 'shopName' ? 'bg-blue-500' : 'hover:bg-blue-300'}`} onMouseDown={(e) => startResize(e, 'shopName')} />
              </th>
              <th style={{ width: colWidths['products'], minWidth: colWidths['products'], maxWidth: colWidths['products'] }} className="relative border-r border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-center whitespace-nowrap min-w-[200px] bg-[#f8f9fa] dark:bg-[#2d2d2d]">
                Sản phẩm <div className={`absolute right-0 top-0 w-1 h-full cursor-col-resize z-20 ${resizingCol === 'products' ? 'bg-blue-500' : 'hover:bg-blue-300'}`} onMouseDown={(e) => startResize(e, 'products')} />
              </th>
              <th style={{ width: colWidths['total'], minWidth: colWidths['total'], maxWidth: colWidths['total'] }} className="relative border-r border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-center whitespace-nowrap bg-[#f8f9fa] dark:bg-[#2d2d2d]">
                Tổng tiền <div className={`absolute right-0 top-0 w-1 h-full cursor-col-resize z-20 ${resizingCol === 'total' ? 'bg-blue-500' : 'hover:bg-blue-300'}`} onMouseDown={(e) => startResize(e, 'total')} />
              </th>
              <th style={{ width: colWidths['status'], minWidth: colWidths['status'], maxWidth: colWidths['status'] }} className="relative border-r border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-center whitespace-nowrap bg-[#f8f9fa] dark:bg-[#2d2d2d]">
                Trạng thái <div className={`absolute right-0 top-0 w-1 h-full cursor-col-resize z-20 ${resizingCol === 'status' ? 'bg-blue-500' : 'hover:bg-blue-300'}`} onMouseDown={(e) => startResize(e, 'status')} />
              </th>
              <th style={{ width: colWidths['trackingNo'], minWidth: colWidths['trackingNo'], maxWidth: colWidths['trackingNo'] }} className="relative border-r border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-center whitespace-nowrap bg-[#f8f9fa] dark:bg-[#2d2d2d]">
                Mã Vận Đơn <div className={`absolute right-0 top-0 w-1 h-full cursor-col-resize z-20 ${resizingCol === 'trackingNo' ? 'bg-blue-500' : 'hover:bg-blue-300'}`} onMouseDown={(e) => startResize(e, 'trackingNo')} />
              </th>
              <th style={{ width: colWidths['shipper'], minWidth: colWidths['shipper'], maxWidth: colWidths['shipper'] }} className="relative border-r border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-center whitespace-nowrap bg-[#f8f9fa] dark:bg-[#2d2d2d]">
                Shipper <div className={`absolute right-0 top-0 w-1 h-full cursor-col-resize z-20 ${resizingCol === 'shipper' ? 'bg-blue-500' : 'hover:bg-blue-300'}`} onMouseDown={(e) => startResize(e, 'shipper')} />
              </th>
              <th style={{ width: colWidths['phone'], minWidth: colWidths['phone'], maxWidth: colWidths['phone'] }} className="relative border-r border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-center whitespace-nowrap bg-[#f8f9fa] dark:bg-[#2d2d2d]">
                SĐT Khách <div className={`absolute right-0 top-0 w-1 h-full cursor-col-resize z-20 ${resizingCol === 'phone' ? 'bg-blue-500' : 'hover:bg-blue-300'}`} onMouseDown={(e) => startResize(e, 'phone')} />
              </th>
              <th style={{ width: colWidths['address'], minWidth: colWidths['address'], maxWidth: colWidths['address'] }} className="relative border-b border-[#c0c0c0] dark:border-[#444] font-normal py-1.5 px-2 text-center whitespace-nowrap min-w-[200px] bg-[#f8f9fa] dark:bg-[#2d2d2d]">
                Địa chỉ <div className={`absolute right-0 top-0 w-1 h-full cursor-col-resize z-20 ${resizingCol === 'address' ? 'bg-blue-500' : 'hover:bg-blue-300'}`} onMouseDown={(e) => startResize(e, 'address')} />
              </th>
            </tr>
          </thead>
            {loading ? (
              <tbody>
                <tr>
                  <td colSpan={15} className="text-center p-8 text-[#666] dark:text-[#aaa]">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" />
                  </td>
                </tr>
              </tbody>
            ) : paginatedSessions.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={15} className="text-center p-8 text-[#666] dark:text-[#aaa] italic">
                    Không có dữ liệu
                  </td>
                </tr>
              </tbody>
            ) : (
              paginatedSessions.map((session) => {
                const orders = session.filteredOrders;
                const rowCount = Math.max(1, orders.length);
                const isSelected = selectedIds.includes(session.id);
                const bgClass = isSelected ? "bg-[#e8f0fe] dark:bg-[#3b5070]" : "hover:bg-[#f1f3f4] dark:hover:bg-[#2a2a2a]";
                
                return (
                  <tbody key={session.id} className={`group/tbody ${bgClass}`}>
                    {Array.from({ length: rowCount }).map((_, idx) => {
                      const order = orders[idx];
                      let shipperName = "";
                      let shipperPhone = "";
                      let orderTime = "-";
                      let providerName = "";
                      if (order) {
                        let parsedDetails = order.details;
                        if (typeof parsedDetails === 'string') {
                          try { parsedDetails = JSON.parse(parsedDetails); } catch (e) {}
                        }
                        shipperName = parsedDetails?.detail?.shipper_name || parsedDetails?.shipper_name || "";
                        let rawShipperPhone = parsedDetails?.detail?.shipper_phone || parsedDetails?.shipper_phone || "";
                        shipperPhone = rawShipperPhone ? rawShipperPhone.split(/Hotline/i)[0].trim() : "";
                        providerName = parsedDetails?.detail?.logistics?.provider_name || parsedDetails?.detail?.logistics?.delivery_option_name || parsedDetails?.detail?.logistics?.shipping_provider || parsedDetails?.detail?.logistics?.logistics_name || "";
                        
                        const orderedAt = parsedDetails?.detail?.timeline?.ordered_at || parsedDetails?.timeline?.ordered_at;
                        const ts = parsedDetails?.detail?.create_time || parsedDetails?.create_time;
                        if (orderedAt) {
                          orderTime = orderedAt;
                        } else if (ts) {
                          if (typeof ts === 'number') {
                            orderTime = formatDate(new Date(ts < 1e12 ? ts * 1000 : ts));
                          } else {
                            orderTime = formatDate(ts);
                          }
                        } else if (order.updatedAt) {
                          orderTime = formatDate(order.updatedAt);
                        }
                      }
                      
                      return (
                        <tr key={`${session.id}-${idx}`} className="group">
                          {idx === 0 && (
                        <>
                          <td rowSpan={rowCount} className="border-r border-b border-[#c0c0c0] dark:border-[#444] p-1.5 text-center align-middle w-8">
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => toggleSelect(session.id)}
                              className="accent-blue-600"
                            />
                          </td>
                          <td rowSpan={rowCount} className="border-r border-b border-[#c0c0c0] dark:border-[#444] p-1.5 align-middle text-center w-24">
                            <div className="flex justify-center gap-2 flex-wrap">
                              <button 
                                onClick={() => handleCopyCard(session as any)} 
                                className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300" 
                                title="Copy thẻ"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
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
                          <td rowSpan={rowCount} className="border-r border-b border-[#c0c0c0] dark:border-[#444] p-1.5 align-middle text-center max-w-[120px]">
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate mx-auto" title={session.session}>{session.session}</span>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity"><CopyBtn text={session.session} /></div>
                            </div>
                            <div className="mt-1 text-[10px]">
                              {session.isActive ? <span className="text-emerald-600 dark:text-emerald-400 font-bold">Hoạt động</span> : <span className="text-rose-600 dark:text-rose-400 font-bold">Lỗi</span>}
                            </div>
                          </td>
                          <td rowSpan={rowCount} className="border-r border-b border-[#c0c0c0] dark:border-[#444] p-1.5 align-middle text-center">
                            <TiktokUserInfo sessionStr={session.session} />
                          </td>
                          <td rowSpan={rowCount} className="border-r border-b border-[#c0c0c0] dark:border-[#444] p-1.5 align-middle text-center" style={colWidths['note'] ? { maxWidth: colWidths['note'] } : { maxWidth: '200px' }}>
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
                                className="cursor-text min-h-[20px] text-xs text-[#333] dark:text-[#ccc] line-clamp-2 break-words" 
                                title={session.note || "Trống"}
                                onClick={() => { setEditingNoteId(session.id); setEditingNoteText(session.note || ""); }}
                              >
                                {session.note || <span className="text-[#999] italic break-normal">Trống</span>}
                              </div>
                            )}
                          </td>
                        </>
                      )}

                      {order ? (
                        <>
                          <td className="border-r border-b border-[#c0c0c0] dark:border-[#444] p-1.5 align-middle text-center">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-mono mx-auto">{order.orderId}</span>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity"><CopyBtn text={order.orderId} /></div>
                            </div>
                          </td>
                          <td className="border-r border-b border-[#c0c0c0] dark:border-[#444] p-1.5 whitespace-nowrap text-[11px] align-middle text-center">
                            {orderTime}
                          </td>
                          <td className="border-r border-b border-[#c0c0c0] dark:border-[#444] p-1.5 min-w-[150px] align-middle text-center" style={colWidths['shopName'] ? { whiteSpace: 'normal', wordBreak: 'break-word' } : {}}>
                            <div className={`transition-all cursor-default mx-auto ${colWidths['shopName'] ? '' : 'line-clamp-2 hover:line-clamp-none'}`} title={order.shopName || ""}>
                              {order.shopName || "-"}
                            </div>
                          </td>
                          <td className="border-r border-b border-[#c0c0c0] dark:border-[#444] p-1.5 min-w-[200px] align-middle" style={colWidths['products'] ? { whiteSpace: 'normal', wordBreak: 'break-word' } : {}}>
                            <div className={`overflow-y-auto custom-scrollbar pr-1 ${colWidths['products'] ? '' : 'max-h-[80px]'}`}>
                              {order.products?.map((p: any, i: number) => (
                                <div key={i} className="mb-0.5 leading-snug" title={p.name}>
                                  • {p.name} <strong className="text-blue-600 dark:text-blue-400">(x{p.qty})</strong>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="border-r border-b border-[#c0c0c0] dark:border-[#444] p-1.5 text-center font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap align-middle">
                            {order.total || "-"}
                          </td>
                          <td className={`border-r border-b border-[#c0c0c0] dark:border-[#444] p-1.5 text-center whitespace-nowrap align-middle ${
                            order.status === "Đã giao" || order.status === "Đã hoàn thành" || order.status?.includes("đã được giao")
                              ? "text-emerald-700 dark:text-emerald-400 font-medium"
                              : order.status === "Đã hủy" || order.status?.includes("hủy")
                                ? "text-rose-700 dark:text-rose-400 font-medium"
                                : "text-amber-700 dark:text-amber-400 font-medium"
                          }`}>
                            {order.status ? order.status.split(/Người nhận/i)[0].replace(/[.\s]+$/, '') : "-"}
                          </td>
                          <td className="border-r border-b border-[#c0c0c0] dark:border-[#444] p-1.5 text-center whitespace-nowrap align-middle">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center justify-between gap-1">
                                <span className="mx-auto">{order.trackingNo || "-"}</span>
                                {order.trackingNo && <div className="opacity-0 group-hover:opacity-100 transition-opacity"><CopyBtn text={order.trackingNo} /></div>}
                              </div>
                              {providerName && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded w-fit mx-auto">
                                  {providerName}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="border-r border-b border-[#c0c0c0] dark:border-[#444] p-1.5 text-center whitespace-nowrap align-middle">
                            <div className="flex flex-col gap-0.5">
                              {shipperName ? <span className="font-semibold mx-auto">{shipperName}</span> : <span className="text-slate-400 italic mx-auto">Chưa rõ</span>}
                              {shipperPhone && (
                                <div className="flex items-center justify-center gap-1">
                                  <span className="text-xs text-blue-600 dark:text-blue-400 mx-auto">{shipperPhone}</span>
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity"><CopyBtn text={shipperPhone} /></div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="border-r border-b border-[#c0c0c0] dark:border-[#444] p-1.5 text-center whitespace-nowrap align-middle">
                            <div className="flex items-center justify-between gap-1">
                              <span className="mx-auto">{order.phone || "-"}</span>
                              {order.phone && <div className="opacity-0 group-hover:opacity-100 transition-opacity"><CopyBtn text={order.phone} /></div>}
                            </div>
                          </td>
                          <td className="border-b border-[#c0c0c0] dark:border-[#444] p-1.5 min-w-[200px] align-middle text-center" style={colWidths['address'] ? { whiteSpace: 'normal', wordBreak: 'break-word' } : {}}>
                            <div className={`transition-all cursor-default mx-auto ${colWidths['address'] ? '' : 'line-clamp-2 hover:line-clamp-none'}`} title={order.address || ""}>
                              {order.address || "-"}
                            </div>
                          </td>
                        </>
                      ) : (
                        <td colSpan={10} className="border-b border-[#c0c0c0] dark:border-[#444] p-1.5 text-center text-[#999] italic">
                          Không có đơn hàng
                        </td>
                      )}
                    </tr>
                  );
                })}
                  </tbody>
                );
              })
            )}
        </table>
      </div>

      {/* Mobile/Tablet View */}
      <div className={`xl:hidden flex flex-col gap-4 ${isFullscreen ? 'flex-1 overflow-y-auto' : ''}`}>
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
        ) : paginatedSessions.length === 0 ? (
          <div className="text-center p-8 text-slate-500 italic bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">Không có dữ liệu</div>
        ) : (
          paginatedSessions.map(session => (
            <div key={session.id} className={`bg-white dark:bg-slate-900 rounded-2xl border ${selectedIds.includes(session.id) ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200 dark:border-slate-700'} shadow-sm overflow-hidden`}>
              {/* Card Header (Session Info) */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.includes(session.id)}
                      onChange={() => toggleSelect(session.id)}
                      className="mt-1 w-4 h-4 accent-blue-600 rounded shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">{session.session.substring(0, 15)}...</span>
                        <CopyBtn text={session.session} />
                        {session.isActive ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Hoạt động</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">Lỗi</span>
                        )}
                      </div>
                      <div className="flex items-center">
                         <TiktokUserInfo sessionStr={session.session} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleCopyCard(session as any)} className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-xl transition">
                      <Copy className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleSyncSession(session.id)} disabled={syncingId === session.id} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition disabled:opacity-50">
                      <RefreshCw className={`w-4 h-4 ${syncingId === session.id ? 'animate-spin' : ''}`} />
                    </button>
                    <button onClick={() => handleDeleteSession(session.id)} className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Note */}
                <div className="text-xs">
                  <div className="font-medium text-slate-500 mb-1 flex items-center gap-1"><Edit2 className="w-3 h-3" /> Ghi chú:</div>
                  {editingNoteId === session.id ? (
                    <textarea
                      value={editingNoteText}
                      onChange={(e) => setEditingNoteText(e.target.value)}
                      className="w-full text-xs p-2 rounded-xl border border-blue-500 outline-none resize-none bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500/20"
                      rows={2}
                      autoFocus
                      onBlur={() => handleUpdateNote(session.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleUpdateNote(session.id); } if (e.key === 'Escape') setEditingNoteId(null); }}
                    />
                  ) : (
                    <div 
                      className="cursor-text p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-[#333] dark:text-[#ccc]" 
                      onClick={() => { setEditingNoteId(session.id); setEditingNoteText(session.note || ""); }}
                    >
                      {session.note || <span className="text-slate-400 italic">Trống (Chạm để thêm)</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Orders List */}
              <div className="p-3 bg-slate-100/50 dark:bg-slate-900/50">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">Đơn hàng ({session.filteredOrders.length})</div>
                {session.filteredOrders.length === 0 ? (
                  <div className="text-center p-4 text-xs text-slate-400 italic bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">Không có đơn hàng</div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {session.filteredOrders.map((order, oIdx) => {
                      let parsedDetails = order.details;
                      if (typeof parsedDetails === 'string') {
                        try { parsedDetails = JSON.parse(parsedDetails); } catch(e){}
                      }
                      const shipperName = parsedDetails?.detail?.shipper_name || parsedDetails?.shipper_name || "";
                      let rawShipperPhone = parsedDetails?.detail?.shipper_phone || parsedDetails?.shipper_phone || "";
                      const shipperPhone = rawShipperPhone ? rawShipperPhone.split(/Hotline/i)[0].trim() : "";
                      const providerName = parsedDetails?.detail?.logistics?.provider_name || parsedDetails?.detail?.logistics?.delivery_option_name || parsedDetails?.detail?.logistics?.shipping_provider || parsedDetails?.detail?.logistics?.logistics_name || "";
                      
                      let orderTime = "-";
                      const ts = parsedDetails?.detail?.create_time || parsedDetails?.create_time;
                      if (ts) {
                        if (typeof ts === 'number') {
                          orderTime = formatDate(new Date(ts < 1e12 ? ts * 1000 : ts));
                        } else {
                          orderTime = formatDate(ts);
                        }
                      } else if (order.updatedAt) {
                        orderTime = formatDate(order.updatedAt);
                      }

                      const statusColor = order.status === "Đã giao" || order.status === "Đã hoàn thành" || order.status?.includes("đã được giao")
                        ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-800/50"
                        : order.status === "Đã hủy" || order.status?.includes("hủy")
                          ? "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-900/20 dark:border-rose-800/50"
                          : "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800/50";

                      return (
                        <div key={oIdx} className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col gap-2">
                          {/* Order Header */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
                            <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-slate-800 dark:text-slate-200">
                              #{order.orderId} <CopyBtn text={order.orderId} />
                            </div>
                            <span className={`px-2 py-1 rounded text-[10px] font-bold border ${statusColor}`}>
                              {order.status ? order.status.split(/Người nhận/i)[0].replace(/[.\s]+$/, '') : "Chờ xử lý"}
                            </span>
                          </div>
                          
                          {/* Details grid */}
                          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs mt-1">
                            <div><span className="text-slate-500">Thời gian:</span> <span className="font-medium text-slate-800 dark:text-slate-200">{orderTime}</span></div>
                            <div><span className="text-slate-500">Tổng tiền:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{order.total || "-"}</span></div>
                            <div className="col-span-2 flex flex-col">
                              <span className="text-slate-500">Shop:</span>
                              <span className="font-medium text-slate-800 dark:text-slate-200 line-clamp-1">{order.shopName || "-"}</span>
                            </div>
                          </div>

                          {/* Tracking & Shipper */}
                          <div className="mt-1 flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2 border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-1.5 text-xs">
                              <Truck className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-medium text-slate-700 dark:text-slate-300">{order.trackingNo || "Chưa có MVĐ"}</span>
                              {order.trackingNo && <CopyBtn text={order.trackingNo} />}
                              {providerName && <span className="ml-auto text-[10px] bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 truncate max-w-[100px]">{providerName}</span>}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">🛵</span>
                              <span className="font-medium text-slate-700 dark:text-slate-300">{shipperName || "Chưa rõ"}</span>
                              {shipperPhone && <><span className="text-blue-600 dark:text-blue-400">{shipperPhone}</span><CopyBtn text={shipperPhone} /></>}
                            </div>
                          </div>

                          {/* Products */}
                          {order.products && order.products.length > 0 && (
                            <div className="mt-1 border-t border-slate-100 dark:border-slate-700 pt-2">
                              <div className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Sản phẩm ({order.products.length})</div>
                              <div className="flex flex-col gap-1 text-xs">
                                {order.products.map((p: any, i: number) => (
                                  <div key={i} className="flex justify-between gap-2">
                                    <span className="text-slate-700 dark:text-slate-300 line-clamp-1 flex-1">• {p.name}</span>
                                    <strong className="text-blue-600 dark:text-blue-400 shrink-0">x{p.qty}</strong>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Customer Info */}
                          <div className="mt-1 border-t border-slate-100 dark:border-slate-700 pt-2 text-xs">
                            <div className="flex items-center gap-2 mb-1">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-medium">{order.phone || "Ẩn"}</span>
                              {order.phone && <CopyBtn text={order.phone} />}
                            </div>
                            <div className="flex items-start gap-2">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                              <span className="text-slate-600 dark:text-slate-400 line-clamp-2">{order.address || "-"}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className={`flex items-center justify-center gap-2 shrink-0 ${isFullscreen ? 'mt-4' : 'py-4'}`}>
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
      </div>
    </section>
  );
}
