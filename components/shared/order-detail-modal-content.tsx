"use client";

import React, { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { getVoucherLabel } from "@/lib/voucher";
import { OrderTimeline } from "./order-timeline";
import { useToast } from "./toast";
import { Mail, Phone, MapPin, Clock } from "lucide-react";

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

  useEffect(() => {
    setAdminForm({
      spcCookie: order.spcCookie || "",
      trackingNo: order.trackingNo || "",
      note: order.note || "",
    });
  }, [order]);

  const isDeliveredOrder = order.status === "DELIVERED";

  const handleSaveOrderInfo = async () => {
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

      addToast("success", "Thông tin đơn hàng đã được cập nhật");
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "Lỗi khi lưu thông tin đơn hàng");
    } finally {
      setIsSavingOrderInfo(false);
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

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      {/* Order Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
              Mã đơn hàng
            </p>
            <p className="text-xl font-bold text-gray-900 dark:text-white font-mono">
              #{order.id}
            </p>
          </div>
          <div className="text-right">
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
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
            Tổng tiền
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {formatCurrency(order.total)}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
            Số lượng
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {order.quantity}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
            Voucher
          </p>
          <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
            {voucherLabel}
          </p>
          {typeof order.unitPrice === "number" ? (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
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
      <div className="space-y-4 text-sm">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Thông tin sản phẩm</h3>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white">
            <div className="space-y-4">
              <div>
                <p className="text-gray-600 dark:text-gray-400 font-medium">Tên sản phẩm</p>
                <p className="mt-1 font-semibold">{order.productName}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-600 dark:text-gray-400 font-medium">Shop ID</p>
                  <p className="mt-1">{order.shopId || "-"}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400 font-medium">Phân loại</p>
                  <p className="mt-1">{order.variant || "Mặc định"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-600 dark:text-gray-400 font-medium">Loại voucher</p>
                  <p className="mt-1">{voucherLabel}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400 font-medium">Giá áp dụng</p>
                  <p className="mt-1">{typeof order.unitPrice === "number" ? formatCurrency(order.unitPrice) : "-"}</p>
                </div>
              </div>
              {order.trackingNo ? (
                <div>
                  <p className="text-gray-600 dark:text-gray-400 font-medium">Mã vận đơn</p>
                  <p className="mt-1">{order.trackingNo}</p>
                </div>
              ) : null}
              <div>
                <p className="text-gray-600 dark:text-gray-400 font-medium">Link Shopee sau phân tích</p>
                <a
                  href={order.productLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block text-sm text-amber-600 dark:text-amber-400 hover:underline break-words"
                >
                  {order.productLink}
                </a>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Thông tin giao hàng</h3>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white">
            <div className="space-y-4">
              <div>
                <p className="text-gray-600 dark:text-gray-400 font-medium">Số điện thoại</p>
                <a href={`tel:${order.phone}`} className="mt-1 block text-amber-600 dark:text-amber-400 hover:underline">
                  {order.phone}
                </a>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 font-medium">Địa chỉ</p>
                <p className="mt-1 whitespace-pre-wrap">{order.address}</p>
              </div>
              {cleanNote ? (
                <div>
                  <p className="text-gray-600 dark:text-gray-400 font-medium">Ghi chú</p>
                  <p className="mt-1 whitespace-pre-wrap">{cleanNote}</p>
                </div>
              ) : null}
              {order.status === "CANCELED" && cancelReason ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/40">
                  <p className="text-rose-700 dark:text-rose-300 font-medium">Lý do hủy đơn</p>
                  <p className="mt-1 text-rose-900 dark:text-rose-200">{cancelReason}</p>
                </div>
              ) : null}
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Clock size={16} />
                <span>Ngày tạo: {formattedDate}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Information */}
      {user && (
        <div>
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
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white">
            <p className="font-medium">
              {responsibleAdmin
                ? typeof currentAdminId === "number" && responsibleAdmin.id === currentAdminId
                  ? `${responsibleAdminName} (Bạn)`
                  : responsibleAdminName
                : "Chưa có admin phụ trách"}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
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
          <div className="min-w-0 max-w-full overflow-x-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex min-w-0 max-w-full flex-col gap-3 overflow-x-hidden">
              <label className="block min-w-0 max-w-full space-y-1 text-sm text-slate-700 dark:text-slate-200">
                <span>Cookie SPC_ST</span>
                <textarea
                  value={adminForm.spcCookie}
                  onChange={(e) => setAdminForm((prev) => ({ ...prev, spcCookie: e.target.value }))}
                  disabled={Boolean(isLockedForAnotherAdmin) || isDeliveredOrder}
                  className="block w-full min-w-0 max-w-full resize-y overflow-x-auto whitespace-pre-wrap [overflow-wrap:anywhere] rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs break-all dark:border-gray-700 dark:bg-gray-800"
                  rows={3}
                  placeholder="SPC_ST=..."
                />
              </label>
              <label className="block min-w-0 max-w-full space-y-1 text-sm text-slate-700 dark:text-slate-200">
                <span>Mã vận đơn</span>
                <input
                  type="text"
                  value={adminForm.trackingNo}
                  onChange={(e) => setAdminForm((prev) => ({ ...prev, trackingNo: e.target.value }))}
                  disabled={Boolean(isLockedForAnotherAdmin) || isDeliveredOrder}
                  className="block w-full min-w-0 max-w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
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
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isLockedForAnotherAdmin
                  ? "Bạn không thể chỉnh sửa vì đơn này đang thuộc admin khác."
                  : isDeliveredOrder
                    ? "Đơn đã giao: chỉ được phép cập nhật ghi chú. SPC_ST và Mã vận đơn đã bị khóa."
                    : canManageAllOrders
                      ? "SPAdmin có thể cập nhật Cookie SPC_ST, Mã vận đơn và ghi chú cho mọi đơn hàng."
                      : "Admin chỉ được cập nhật Cookie SPC_ST, Mã vận đơn và ghi chú cho đơn mình phụ trách."}
              </p>
              <button
                onClick={handleSaveOrderInfo}
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
