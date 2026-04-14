"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { Modal } from "@/components/shared/modal";
import { OrderDetailModalContent } from "@/components/shared/order-detail-modal-content";
import { useToast } from "@/components/shared/toast";

interface OrderData {
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
  isLockerPickup?: boolean;
  status: "PENDING" | "PROCESSING" | "ORDER_PLACED" | "TRACKING_GENERATED" | "DELIVERED" | "CANCELED";
  spcCookie?: string;
  trackingNo?: string;
  shopeeTrackingData?: string | null;
  complaintStatus?: string | null;
  complaintReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
  approvedByAdmin?: {
    id: number;
    username: string;
    fullName?: string;
  } | null;
}

export function ViewUserOrderDetailsButton({ orderId }: { orderId: number }) {
  const { addToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [orderData, setOrderData] = useState<OrderData | null>(null);

  async function readApiResponse(response: Response) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }
    const text = await response.text();
    return { error: text?.slice(0, 120) || "Phản hồi không hợp lệ từ server." };
  }

  function mapOrderData(order: any): OrderData {
    return {
      id: order.id,
      productLink: order.productLink,
      productName: order.productName,
      shopId: order.shopId,
      quantity: order.quantity,
      total: order.total,
      voucherCode: order.voucherCode,
      voucherLabel: order.voucherLabel,
      unitPrice: order.unitPrice,
      phone: order.phone,
      address: order.address,
      variant: order.variant,
      note: order.note,
      cancelReason: order.cancelReason,
      isLockerPickup: order.isLockerPickup,
      status: order.status,
      spcCookie: order.spcCookie,
      trackingNo: order.trackingNo,
      shopeeTrackingData: order.shopeeTrackingData,
      complaintStatus: order.complaintStatus,
      complaintReason: order.complaintReason,
      createdAt: new Date(order.createdAt),
      updatedAt: new Date(order.updatedAt),
      userId: order.userId,
      approvedByAdmin: order.approvedByAdmin
        ? {
            id: order.approvedByAdmin.id,
            username: order.approvedByAdmin.username,
            fullName: order.approvedByAdmin.fullName,
          }
        : null,
    };
  }

  async function handleViewDetails() {
    setIsLoadingDetails(true);
    try {
      const response = await fetch(`/api/order/list`);
      const data = await readApiResponse(response);
      if (!response.ok || !data.orders) {
        throw new Error(data.error || "Không thể tải thông tin đơn hàng");
      }

      const order = data.orders.find((o: any) => o.id === orderId);
      if (!order) {
        throw new Error("Không tìm thấy đơn hàng");
      }

      setOrderData(mapOrderData(order));
      setIsModalOpen(true);
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "Lỗi khi tải chi tiết đơn hàng");
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
        className="shrink-0 rounded-xl bg-amber-600 hover:bg-amber-700 p-2 text-white disabled:opacity-60 transition-colors flex items-center justify-center shadow-sm"
        title="Xem chi tiết"
      >
        {isLoadingDetails ? <span className="text-xs">...</span> : <Eye size={16} />}
      </button>

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
            responsibleAdmin={orderData.approvedByAdmin || null}
            onClose={() => setIsModalOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}
