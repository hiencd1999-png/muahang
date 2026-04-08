"use client";

import React, { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { OrderTimeline } from "./order-timeline";
import { useToast } from "./toast";
import { Mail, Phone, MapPin, Clock } from "lucide-react";

interface Order {
  id: string;
  link: string;
  totalAmount: number;
  fee: number | null;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "CANCELED";
  createdAt: Date;
  updatedAt: Date;
  userId: string;
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
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
              Mã đơn hàng
            </p>
            <p className="text-xl font-bold text-gray-900 dark:text-white font-mono">
              {order.id}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
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

      {/* Order Amount */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
            Tổng tiền
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {formatCurrency(order.totalAmount)}
          </p>
        </div>
        {order.fee !== null && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
              Phí sử dụng
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {formatCurrency(order.fee)}
            </p>
          </div>
        )}
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

      {/* Order Information */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
          Thông tin đơn hàng
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <Clock size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-gray-600 dark:text-gray-400">Ngày tạo</p>
              <p className="text-gray-900 dark:text-white">{formattedDate}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-gray-600 dark:text-gray-400">Link Shopee</p>
              <a
                href={order.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline break-all"
              >
                {order.link}
              </a>
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
