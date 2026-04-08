"use client";

import React, { useState } from "react";
import { formatCurrency } from "@/lib/format";
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
  phone: string;
  address: string;
  variant?: string;
  note?: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "CANCELED";
  createdAt: Date;
  updatedAt: Date;
  userId: number;
}

interface UserInfo {
  username: string;
  email: string;
  phone: string;
}

interface OrderDetailModalContentProps {
  order: Order;
  user?: UserInfo;
  isAdmin?: boolean;
  onClose?: () => void;
}

export function OrderDetailModalContent({
  order,
  user,
  isAdmin = false,
  onClose,
}: OrderDetailModalContentProps) {
  const [adminNotes, setAdminNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const { addToast } = useToast();

  const handleSaveNotes = async () => {
    if (!adminNotes.trim()) {
      addToast("info", "Vui lòng nhập ghi chú");
      return;
    }

    setIsSavingNotes(true);
    try {
      const response = await fetch(`/api/admin/order/update/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: adminNotes }),
      });

      if (!response.ok) throw new Error("Failed to save notes");

      addToast("success", "Ghi chú đã được lưu");
      setAdminNotes("");
    } catch (error) {
      addToast("error", "Lỗi khi lưu ghi chú");
    } finally {
      setIsSavingNotes(false);
    }
  };

  const createdDate = new Date(order.createdAt);
  const formattedDate = createdDate.toLocaleString("vi-VN");

  return (
    <div className="space-y-6">
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
                  Chờ xử lý
                </span>
              )}
              {order.status === "PROCESSING" && (
                <span className="text-blue-600 dark:text-blue-400">
                  Đang xử lý
                </span>
              )}
              {order.status === "COMPLETED" && (
                <span className="text-green-600 dark:text-green-400">
                  Hoàn thành
                </span>
              )}
              {order.status === "CANCELED" && (
                <span className="text-red-600 dark:text-red-400">Bị hủy</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Order Details */}
      <div className="grid grid-cols-2 gap-4">
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

      {/* Product Information */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
          Thông tin sản phẩm
        </h3>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">Tên sản phẩm</p>
            <p className="text-gray-900 dark:text-white mt-1">{order.productName}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">Shop ID</p>
              <p className="text-gray-900 dark:text-white mt-1">{order.shopId || "-"}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">Phân loại</p>
              <p className="text-gray-900 dark:text-white mt-1">{order.variant || "Mặc định"}</p>
            </div>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">Link Shopee</p>
            <a
              href={order.productLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-600 dark:text-amber-400 hover:underline break-all text-xs mt-1"
            >
              {order.productLink}
            </a>
          </div>
        </div>
      </div>

      {/* Delivery Information */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
          Thông tin giao hàng
        </h3>
        <div className="space-y-2 text-sm">
          <div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">Số điện thoại</p>
            <a href={`tel:${order.phone}`} className="text-amber-600 dark:text-amber-400 hover:underline mt-1">
              {order.phone}
            </a>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">Địa chỉ</p>
            <p className="text-gray-900 dark:text-white mt-1 whitespace-pre-wrap">{order.address}</p>
          </div>
          {order.note && (
            <div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">Ghi chú</p>
              <p className="text-gray-900 dark:text-white mt-1">{order.note}</p>
            </div>
          )}
          <div className="flex items-start gap-2">
            <Clock size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-gray-600 dark:text-gray-400">Ngày tạo</p>
              <p className="text-gray-900 dark:text-white">{formattedDate}</p>
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
                {user.username}
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

      {/* Admin Notes */}
      {isAdmin && (
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
            Ghi chú quản trị
          </h3>
          <div className="space-y-2">
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Thêm ghi chú nội bộ cho đơn hàng này..."
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
            <button
              onClick={handleSaveNotes}
              disabled={isSavingNotes}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              {isSavingNotes ? "Đang lưu..." : "Lưu ghi chú"}
            </button>
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
