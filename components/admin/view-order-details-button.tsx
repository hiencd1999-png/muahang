"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { Modal } from "@/components/shared/modal";
import { OrderDetailModalContent } from "@/components/shared/order-detail-modal-content";
import { useToast } from "@/components/shared/toast";

export function ViewOrderDetailsButton({
  orderId,
  currentAdminId,
  canManageAllOrders,
}: {
  orderId: number;
  currentAdminId: number;
  canManageAllOrders: boolean;
}) {
  const { addToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);

  async function readApiResponse(response: Response) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }
    const text = await response.text();
    return { error: text?.slice(0, 120) || "Phản hồi không hợp lệ từ server." };
  }

  async function handleViewDetails() {
    setIsLoadingDetails(true);
    try {
      const response = await fetch(`/api/admin/order/${orderId}`);
      const data = await readApiResponse(response);

      if (response.ok && data.order) {
        setOrderData(data.order);
        setIsModalOpen(true);
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
        className="shrink-0 rounded-xl bg-slate-500 hover:bg-slate-600 p-2 text-white disabled:opacity-60 transition-colors flex items-center justify-center shadow-sm"
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
            user={orderData.user}
            isAdmin={true}
            currentAdminId={currentAdminId}
            canManageAllOrders={canManageAllOrders}
            responsibleAdmin={orderData.approvedByAdmin || null}
            onClose={() => setIsModalOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}
