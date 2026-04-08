"use client";

import { useState } from "react";
import { useToast } from "@/components/shared/toast";
import { Eye } from "lucide-react";
import { Modal } from "@/components/shared/modal";
import { OrderDetailModalContent } from "@/components/shared/order-detail-modal-content";

interface OrderData {
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
  status: "PENDING" | "PROCESSING" | "ORDER_PLACED" | "TRACKING_GENERATED" | "DELIVERED" | "CANCELED";
  spcCookie?: string;
  trackingNo?: string;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
}

export function UserOrderActions({ orderId, status }: { orderId: number; status: string }) {
  const { addToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  async function handleViewDetails() {
    setIsLoadingDetails(true);
    try {
      const response = await fetch(`/api/order/list`);
      const data = await response.json();

      if (response.ok && data.orders) {
        const order = data.orders.find((o: any) => o.id === orderId);
        if (order) {
          setOrderData({
            id: order.id,
            productLink: order.productLink,
            productName: order.productName,
            shopId: order.shopId,
            quantity: order.quantity,
            total: order.total,
            phone: order.phone,
            address: order.address,
            variant: order.variant,
            note: order.note,
            status: order.status,
            spcCookie: order.spcCookie,
            trackingNo: order.trackingNo,
            createdAt: new Date(order.createdAt),
            updatedAt: new Date(order.updatedAt),
            userId: order.userId,
          });
          setIsModalOpen(true);
        } else {
          addToast("error", "Không tìm thấy đơn hàng");
        }
      } else {
        addToast("error", data.error || "Không thể tải thông tin đơn hàng");
      }
    } catch (error) {
      addToast("error", "Lỗi khi tải chi tiết đơn hàng");
      console.error(error);
    } finally {
      setIsLoadingDetails(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleViewDetails}
        disabled={isLoadingDetails}
        className="rounded-xl bg-amber-600 hover:bg-amber-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 transition-colors inline-flex items-center gap-1.5"
        title="Xem chi tiết"
      >
        {isLoadingDetails ? "..." : <><Eye size={14} /> Chi tiết</>}
      </button>

      {/* Order Detail Modal */}
      {orderData && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`Chi tiết đơn hàng #${orderData.id}`}
          size="large"
        >
          <OrderDetailModalContent
            order={orderData}
            isAdmin={false}
            onClose={() => setIsModalOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}
