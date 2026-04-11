"use client";

import React, { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { getVoucherLabel } from "@/lib/voucher";
import { OrderTimeline } from "./order-timeline";
import { useToast } from "./toast";
import { Mail, Phone, Clock } from "lucide-react";

interface Order {
  id: number;
  productLink: string;
  productName: string;
  shopId: string | null;
  quantity: number;
  total: number;
  voucherCode?: string | null;
  voucherLabel?: string | null;
  unitPrice?: number | null;
  phone: string;
  address: string;
  variant?: string;
  note?: string;
  cancelReason?: string;
  status: "PENDING" | "PROCESSING" | "ORDER_PLACED" | "TRACKING_GENERATED" | "DELIVERED" | "CANCELED";
  spcCookie?: string;
  trackingNo?: string;
  shopeeTrackingData?: string | null;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
}

interface UserInfo {
  username: string;
  fullName?: string;
  email: string;
  phone: string;
}

interface OrderDetailModalContentProps {
  order: Order;
  user?: UserInfo;
  isAdmin?: boolean;
  currentAdminId?: number;
  canManageAllOrders?: boolean;
  responsibleAdmin?: { id: number; username: string; fullName?: string } | null;
  onClose?: () => void;
}

export function OrderDetailModalContent({
  order,
  user,
  isAdmin = false,
  currentAdminId,
  canManageAllOrders = false,
  responsibleAdmin,
  onClose,
}: OrderDetailModalContentProps) {
  const [adminForm, setAdminForm] = useState({
    spcCookie: order.spcCookie || "",
    trackingNo: order.trackingNo || "",
    note: order.note || "",
  });
  const [isSavingOrderInfo, setIsSavingOrderInfo] = useState(false);
  const { addToast } = useToast();

  const [shopeeTracking, setShopeeTracking] = useState<any[] | null>(() => {
    if (order.shopeeTrackingData) {
      try {
        return JSON.parse(order.shopeeTrackingData);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [isFetchingTracking, setIsFetchingTracking] = useState(false);
  const [trackingFetchError, setTrackingFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!order.spcCookie) return;
    if (order.status === "DELIVERED" || order.status === "CANCELED") return;
    
    let isMounted = true;
    let intervalId: NodeJS.Timeout | undefined;

    const fetchTracking = async () => {
      if (isMounted && !shopeeTracking) setIsFetchingTracking(true);
      try {
        const res = await fetch(`/api/shopee/tracking-sync?orderId=${order.id}`);
        const data = await res.json();
        if (isMounted) {
          if (res.ok && data.tracking) {
            setShopeeTracking(data.tracking);
            setTrackingFetchError(null);
            
            if (data.autoUpdatedStatus === "DELIVERED" || data.autoUpdatedStatus === "CANCELED") {
              if (intervalId) clearInterval(intervalId);
            }
          } else {
            setTrackingFetchError(data.error || "Lỗi khi lấy thông tin tracking");
            if (res.status === 400 && data.error && data.error.includes("Cookie")) {
               if (intervalId) clearInterval(intervalId);
            }
          }
        }
      } catch (err) {
        if (isMounted) setTrackingFetchError("Hệ thống lỗi khi fetch tracking.");
      } finally {
        if (isMounted) setIsFetchingTracking(false);
      }
    };

    fetchTracking();
    intervalId = setInterval(fetchTracking, 5 * 60 * 1000); // 5 minutes

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [order.spcCookie, order.id, order.status]);

  useEffect(() => {
    setAdminForm({
      spcCookie: order.spcCookie || "",
      trackingNo: order.trackingNo || "",
      note: order.note || "",
    });
  }, [order]);

  const isDeliveredOrder = order.status === "DELIVERED";

  const handleSaveOrderInfo = async (skipToast = false) => {
    setIsSavingOrderInfo(true);
    try {
      const response = await fetch(`/api/admin/order/update/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spcCookie: adminForm.spcCookie,
          trackingNo: adminForm.trackingNo,
          note: adminForm.note,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save order info");

      if (!skipToast) {
        addToast("success", "Thông tin đơn hàng đã được cập nhật");
      }
      return true;
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "Lỗi khi lưu thông tin đơn hàng");
      return false;
    } finally {
      setIsSavingOrderInfo(false);
    }
  };

  const handleForceFetchTracking = async () => {
    // Nếu cookie có thay đổi so với DB hoặc đang thiếu tracking, ta chủ động lưu nội dung mới trước
    if (adminForm.spcCookie !== (order.spcCookie || "")) {
      const saved = await handleSaveOrderInfo(true);
      if (!saved) return; // Nếu lưu lỗi thì dừng
    } else if (!adminForm.spcCookie) {
      addToast("error", "Vui lòng nhập cookie SPC_ST");
      return;
    }

    setIsFetchingTracking(true);
    setTrackingFetchError(null);
    try {
      const res = await fetch(`/api/shopee/tracking-sync?orderId=${order.id}&force=true`);
      const data = await res.json();
      if (res.ok && data.tracking) {
        setShopeeTracking(data.tracking);
        setTrackingFetchError(null);
        addToast("success", "Lấy thông tin đơn thành công");
      } else {
        setTrackingFetchError(data.error || "Lỗi khi lấy thông tin tracking");
      }
    } catch (err) {
      setTrackingFetchError("Hệ thống lỗi khi fetch tracking.");
    } finally {
      setIsFetchingTracking(false);
    }
  };

  const createdDate = new Date(order.createdAt);
  const formattedDate = createdDate.toLocaleString("vi-VN");
  const cancelReason = order.cancelReason?.trim();
  const cleanNote = order.note?.trim();
  const voucherLabel = order.voucherLabel || getVoucherLabel(order.voucherCode);
  const isLockedForAnotherAdmin =
    isAdmin &&
    !canManageAllOrders &&
    responsibleAdmin &&
    typeof currentAdminId === "number" &&
    responsibleAdmin.id !== currentAdminId;
  const responsibleAdminName = responsibleAdmin?.fullName || responsibleAdmin?.username;
  const canViewSensitiveInfo = !isAdmin || canManageAllOrders || (isAdmin && typeof currentAdminId === "number" && responsibleAdmin?.id === currentAdminId);

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
      {/* Order Header */}
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 dark:border-amber-800 dark:from-amber-900/20 dark:to-orange-900/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
              Mã đơn hàng
            </p>
            <p className="text-xl font-bold text-gray-900 dark:text-white font-mono">
              #{order.id}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
              Trạng thái
            </p>
            <p className="text-lg font-bold">
              {order.status === "PENDING" && (
                <span className="text-yellow-600 dark:text-yellow-400">
                  Chờ duyệt
                </span>
              )}
              {order.status === "PROCESSING" && (
                <span className="text-sky-600 dark:text-sky-400">
                  Đang xử lý
                </span>
              )}
              {order.status === "ORDER_PLACED" && (
                <span className="text-blue-600 dark:text-blue-400">
                  Đã đặt đơn
                </span>
              )}
              {order.status === "TRACKING_GENERATED" && (
                <span className="text-indigo-600 dark:text-indigo-400">
                  Đã lên mã VĐ
                </span>
              )}
              {order.status === "DELIVERED" && (
                <span className="text-green-600 dark:text-green-400">
                  Đã giao hàng
                </span>
              )}
              {order.status === "CANCELED" && (
                <span className="text-red-600 dark:text-red-400">Đã hủy</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Order Details */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="min-w-0 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/40 dark:bg-amber-900/10 shadow-sm shadow-amber-900/5">
          <p className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-500 tracking-wider">
            Tổng tiền
          </p>
          <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">
            {formatCurrency(order.total)}
          </p>
        </div>
        <div className="min-w-0 rounded-2xl bg-slate-50 p-5 border border-slate-100 dark:bg-slate-800/40 dark:border-slate-700/80 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
            Số lượng
          </p>
          <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">
            {order.quantity}
          </p>
        </div>
        <div className="min-w-0 rounded-2xl bg-slate-50 p-5 border border-slate-100 dark:bg-slate-800/40 dark:border-slate-700/80 shadow-sm sm:col-span-2 xl:col-span-1">
          <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
            Voucher
          </p>
          <p className="mt-1 break-words text-lg font-black text-slate-900 dark:text-white">
            {voucherLabel}
          </p>
          {typeof order.unitPrice === "number" ? (
            <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">
              {formatCurrency(order.unitPrice)} / sản phẩm
            </p>
          ) : null}
        </div>
      </div>

      {/* Timeline */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">
          Quá trình xử lý
        </h3>
        <OrderTimeline
          currentStatus={order.status}
          createdAt={new Date(order.createdAt)}
          updatedAt={new Date(order.updatedAt)}
        />
      </div>

      {/* Product & Delivery Information */}
      <div className="flex flex-col gap-6 text-sm">
        <div className="min-w-0">
          <h3 className="mb-4 text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Thông tin sản phẩm
          </h3>
          <div className="min-w-0 space-y-5 rounded-3xl border border-slate-200 bg-slate-50 dark:border-slate-700/80/80 dark:bg-slate-950/40 p-6 shadow-inner">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Tên sản phẩm</p>
              <p className="mt-2 text-base break-words font-black text-slate-900 dark:text-white">{order.productName}</p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Loại voucher</p>
                <p className="mt-1.5 font-bold text-slate-800 dark:text-slate-200">{voucherLabel}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Giá áp dụng</p>
                <p className="mt-1.5 font-black text-amber-700 dark:text-amber-500 text-lg">{typeof order.unitPrice === "number" ? formatCurrency(order.unitPrice) : "-"}</p>
              </div>
            </div>
            {order.trackingNo ? (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                <p className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider mb-1">Mã vận đơn</p>
                <p className="font-black text-indigo-900 dark:text-indigo-300 font-mono text-lg break-all">{order.trackingNo}</p>
              </div>
            ) : null}
            <div>
              <p className="font-medium text-gray-600 dark:text-gray-400">Danh sách link Shopee sau phân tích</p>
              <div className="mt-2 space-y-1">
                {(() => {
                  // Tách các link, phân loại, số lượng từ order.note
                  // Ưu tiên lấy từ order.note nếu có dòng "Chi tiết link:" (theo logic API)
                  const detailLines: string[] = [];
                  if (order.note && order.note.includes('Chi tiết link:')) {
                    const match = order.note.match(/Chi tiết link:\n([\s\S]*)/);
                    if (match) {
                      detailLines.push(...match[1].split('\n').map(l => l.trim()).filter(Boolean));
                    }
                  }
                  
                  // Nếu vẫn không có, tức là đơn 1 sản phẩm, gộp cừng từ các trường tĩnh của order
                  if (detailLines.length === 0) {
                    detailLines.push(`${order.productLink} | Phân loại: ${order.variant || 'Mặc định'} | SL: ${order.quantity}`);
                  }
                  return detailLines.map((line, idx) => {
                    // Tìm link, phân loại, số lượng trong từng dòng
                    // Dòng chuẩn: "1. https://... | Phân loại: ... | SL: ..."
                    // Nếu không đúng chuẩn thì vẫn render nguyên dòng
                    const parts = line.split('|').map(s => s.trim());
                    let link = '', variant = '', qty = '';
                    if (parts.length >= 3) {
                      // Có đủ 3 phần
                      link = parts[0].replace(/^\d+\.\s*/, '');
                      variant = parts[1].replace(/^Phân loại:?\s*/, '');
                      qty = parts[2].replace(/^SL:?\s*/, '');
                    } else {
                      link = line;
                    }
                    return (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                        <span className="font-mono text-xs text-slate-800 dark:text-slate-200">
                          {`${idx + 1}. `}
                          <a href={link} target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:underline break-all">
                            {link}
                          </a>
                        </span>
                        {variant && (
                          <span className="text-xs text-slate-600 dark:text-slate-300">| Phân loại: {variant}</span>
                        )}
                        {qty && (
                          <span className="text-xs text-slate-600 dark:text-slate-300">| SL: {qty}</span>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <h3 className="mb-4 text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Thông tin giao hàng
          </h3>
          {canViewSensitiveInfo ? (
            <div className="min-w-0 space-y-5 rounded-3xl border border-slate-200 bg-slate-50 dark:border-slate-700/80/80 dark:bg-slate-950/40 p-6 shadow-inner">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Số điện thoại</p>
                <a href={`tel:${order.phone}`} className="mt-2 block font-black text-lg text-amber-700 hover:underline dark:text-amber-400 transition-colors">
                  {order.phone}
                </a>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Địa chỉ chi tiết</p>
                <p className="mt-2 font-bold text-slate-800 dark:text-slate-100 leading-relaxed max-w-lg">{order.address}</p>
              </div>
              {/* Ẩn ghi chú khỏi dashboard user, chỉ admin xem được */}
              {order.status === "CANCELED" && cancelReason ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/40">
                  <p className="font-medium text-rose-700 dark:text-rose-300">Lý do hủy đơn</p>
                  <p className="mt-1 break-words text-rose-900 dark:text-rose-200">{cancelReason}</p>
                </div>
              ) : null}
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Clock size={16} />
                <span>Ngày tạo: {formattedDate}</span>
              </div>
            </div>
          ) : (
            <div className="min-w-0 rounded-3xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700/80 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400 italic">
              Thông tin bị ẩn. Bạn cần nhận Duyệt phụ trách đơn này để có thể xem thông tin giao hàng của khách.
            </div>
          )}
        </div>
      </div>

      {/* Shopee Tracking */}
      {order.spcCookie && (
        <div className="min-w-0 max-w-full overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Thông tin vận chuyển Shopee
            </h3>
            {isFetchingTracking && <span className="text-xs text-blue-500 animate-pulse">Đang đồng bộ...</span>}
          </div>
          {trackingFetchError && (
            <p className="text-xs italic text-red-500 mb-2">{trackingFetchError}</p>
          )}
          {!shopeeTracking && !isFetchingTracking && !trackingFetchError && (
            <p className="text-xs text-gray-500">Chưa có thông tin tracking.</p>
          )}
          {shopeeTracking && shopeeTracking.length === 0 && (
            <p className="text-xs text-gray-500">Cookie không tìm thấy đơn hàng nào.</p>
          )}
          {shopeeTracking && shopeeTracking.length > 0 && (
            <div className="space-y-4">
              {shopeeTracking.map((trk, idx) => (
                <div key={idx} className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/50 dark:bg-blue-900/20 text-sm break-words overflow-hidden">
                  <div className="grid gap-2 mb-4">
                    <p><strong>Order ID:</strong> <span className="font-mono text-blue-700 dark:text-blue-400">{trk.order_id}</span></p>
                    <p><strong>Mã VĐ:</strong> <span className="font-mono">{trk.tracking_number || "Chưa có"}</span></p>
                    <p><strong>Trạng thái:</strong> {trk.description}</p>
                    <p><strong>Người nhận:</strong> {trk.shipping_name} {trk.shipping_phone ? `| ${trk.shipping_phone}` : ""}</p>
                    <p><strong>Địa chỉ:</strong> {trk.shipping_address}</p>
                    <p><strong>Sản phẩm:</strong> <span className="italic">{trk.name}</span></p>
                    {trk.model_name && <p><strong>Mẫu:</strong> <span className="text-gray-600">{trk.model_name}</span></p>}
                    {(trk.driver_name || trk.driver_phone) && (
                      <p><strong>Tài xế:</strong> {trk.driver_name} {trk.driver_phone ? `| ${trk.driver_phone}` : ""}</p>
                    )}
                    {trk.logistics?.carrier_name && (
                      <p><strong>ĐVVC:</strong> {trk.logistics.carrier_name}</p>
                    )}
                  </div>
                  {trk.logistics?.history?.length > 0 && (
                    <div className="mt-4 border-t border-blue-200 dark:border-blue-800 pt-3">
                      <p className="font-semibold text-xs mb-2 text-slate-700 dark:text-slate-300">Lịch sử giao hàng (Mới nhất):</p>
                      <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                        {trk.logistics.history.map((h: any, hIdx: number) => (
                          <div key={hIdx} className="text-xs text-slate-600 dark:text-slate-300 pl-3 border-l-2 border-slate-300 dark:border-slate-700 pb-2">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{h.ctime_text}</span>
                            <p className="mt-0.5">{h.description}</p>
                            {h.driver_name && <span className="block mt-0.5 opacity-80">Tài xế: {h.driver_name} - {h.driver_phone}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Customer Information */}
      {user && canViewSensitiveInfo && (
        <div className="min-w-0 max-w-full">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
            Thông tin khách hàng
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="font-medium text-gray-700 dark:text-gray-300 min-w-20">
                Tên user:
              </span>
              <span className="text-gray-900 dark:text-white">
                {user.fullName || user.username}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Mail size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-gray-600 dark:text-gray-400">Email</p>
                <a
                  href={`mailto:${user.email}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {user.email}
                </a>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Phone size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-gray-600 dark:text-gray-400">Số điện thoại</p>
                <a
                  href={`tel:${user.phone}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {user.phone}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {responsibleAdmin || isAdmin ? (
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
            Admin phụ trách
          </h3>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900 dark:border-slate-700/80 dark:bg-slate-900 dark:text-white">
            <p className="font-medium">
              {responsibleAdmin
                ? typeof currentAdminId === "number" && responsibleAdmin.id === currentAdminId
                  ? `${responsibleAdminName} (Bạn)`
                  : responsibleAdminName
                : "Chưa có admin phụ trách"}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
              {isAdmin
                ? "Đơn sẽ thuộc quyền xử lý của admin đầu tiên duyệt đơn này."
                : "Tên admin sẽ hiển thị sau khi đơn được admin tiếp nhận xử lý."}
            </p>
          </div>
        </div>
      ) : null}

      {/* Admin Notes */}
      {isAdmin && (
        <div className="min-w-0 max-w-full">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
            Cập nhật logistics đơn hàng
          </h3>
          <div className="min-w-0 max-w-full overflow-x-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700/80 dark:bg-slate-900">
            <div className="flex min-w-0 max-w-full flex-col gap-3 overflow-x-hidden">
              <label className="block min-w-0 max-w-full space-y-1 text-sm text-slate-700 dark:text-slate-200">
                <div className="flex items-center justify-between">
                  <span>Cookie SPC_ST</span>
                  <button
                    type="button"
                    onClick={handleForceFetchTracking}
                    disabled={isFetchingTracking || Boolean(isLockedForAnotherAdmin) || isDeliveredOrder || order.status === "PENDING" || order.status === "PROCESSING"}
                    className="px-2 py-1 text-[10px] sm:text-xs font-semibold bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 dark:hover:bg-amber-900/60 rounded border border-amber-200 dark:border-amber-800 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {isFetchingTracking ? "Đang lấy..." : "Lấy thông tin đơn"}
                  </button>
                </div>
                <textarea
                  value={adminForm.spcCookie}
                  onChange={(e) => setAdminForm((prev) => ({ ...prev, spcCookie: e.target.value }))}
                  readOnly={order.status === "PENDING" || order.status === "PROCESSING"}
                  disabled={Boolean(isLockedForAnotherAdmin) || isDeliveredOrder || order.status === "PENDING" || order.status === "PROCESSING"}
                  className={`block w-full min-w-0 max-w-full resize-y overflow-x-auto whitespace-pre-wrap [overflow-wrap:anywhere] rounded-lg border font-mono text-xs break-all px-3 py-2 ${
                    Boolean(isLockedForAnotherAdmin) || isDeliveredOrder || order.status === "PENDING" || order.status === "PROCESSING"
                      ? "bg-gray-100 border-gray-300 dark:border-gray-700 dark:bg-gray-800/80 cursor-not-allowed opacity-70"
                      : "bg-white border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                  }`}
                  rows={3}
                  placeholder={
                    order.status === "PENDING" || order.status === "PROCESSING"
                      ? "Chỉ được nhập lần đầu trong lúc bấm Đặt đơn"
                      : "SPC_ST=..."
                  }
                />
              </label>
              <label className="block min-w-0 max-w-full space-y-1 text-sm text-slate-700 dark:text-slate-200">
                <span>Mã vận đơn</span>
                <textarea
                  value={adminForm.trackingNo}
                  onChange={(e) => setAdminForm((prev) => ({ ...prev, trackingNo: e.target.value }))}
                  disabled={Boolean(isLockedForAnotherAdmin) || isDeliveredOrder}
                  rows={2}
                  className="block w-full min-w-0 max-w-full rounded-lg border border-gray-300 bg-white px-3 py-2 whitespace-pre-wrap dark:border-gray-700 dark:bg-gray-800"
                />
              </label>
              <label className="block min-w-0 max-w-full space-y-1 text-sm text-slate-700 dark:text-slate-200">
                <span>Ghi chú admin</span>
                <textarea
                  value={adminForm.note}
                  onChange={(e) => setAdminForm((prev) => ({ ...prev, note: e.target.value }))}
                  disabled={Boolean(isLockedForAnotherAdmin)}
                  className="block w-full min-w-0 max-w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                  rows={3}
                  placeholder="Ghi chú nội bộ cho đơn hàng"
                />
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-300">
                {isLockedForAnotherAdmin
                  ? "Bạn không thể chỉnh sửa vì đơn này đang thuộc admin khác."
                  : isDeliveredOrder
                    ? "Đơn đã giao: chỉ được phép cập nhật ghi chú. Mã vận đơn và Cookie đã bị khóa."
                    : canManageAllOrders
                      ? "SPAdmin có thể cập nhật Cookie SPC_ST (sau khi đặt đơn), Mã vận đơn và ghi chú cho mọi đơn hàng."
                      : "Admin chỉ được cập nhật Cookie SPC_ST (sau khi đặt đơn), Mã vận đơn và ghi chú cho đơn mình phụ trách."}
              </p>
              <button
                onClick={() => handleSaveOrderInfo()}
                disabled={isSavingOrderInfo || Boolean(isLockedForAnotherAdmin)}
                className="self-start px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                {isSavingOrderInfo ? "Đang lưu..." : "Lưu logistics"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Button */}
      {onClose && (
        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
        >
          Đóng
        </button>
      )}
    </div>
  );
}
