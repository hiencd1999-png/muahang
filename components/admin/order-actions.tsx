"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "CANCELED";
  createdAt: Date;
  updatedAt: Date;
  userId: number;
  user?: {
    username: string;
    email: string;
    phone: string;
  };
}

export function OrderActions({ orderId, status }: { orderId: number; status: string }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  async function updateStatus(nextStatus: string) {
    setLoading(nextStatus);

    const response = await fetch("/api/admin/order/update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, status: nextStatus }),
    });

    if (response.ok) {
      addToast("success", "Cập nhật trạng thái thành công!");
      router.refresh();
    } else {
      const data = await response.json();
      addToast("error", data.error ?? "Cập nhật thất bại.");
    }

    setLoading("");
  }

  async function handleViewDetails() {
    setIsLoadingDetails(true);
    try {
      const response = await fetch(`/api/admin/order/${orderId}`);
      const data = await response.json();

      if (response.ok && data.order) {
        const order = data.order;
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
          createdAt: new Date(order.createdAt),
          updatedAt: new Date(order.updatedAt),
          userId: order.userId,
          user: order.user,
        });
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
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleViewDetails}
          disabled={isLoadingDetails}
          className="rounded-xl bg-slate-500 hover:bg-slate-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 transition-colors flex items-center gap-1"
          title="Xem chi tiết"
        >
          {isLoadingDetails ? "..." : <><Eye size={14} /> Chi tiết</>}
        </button>
        {status === "PENDING" ? (
          <button
            type="button"
            onClick={() => updateStatus("PROCESSING")}
            disabled={loading !== ""}
            className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {loading === "PROCESSING" ? "..." : "Duyệt"}
          </button>
        ) : null}
        {status === "PROCESSING" ? (
          <button
            type="button"
            onClick={() => updateStatus("COMPLETED")}
            disabled={loading !== ""}
            className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {loading === "COMPLETED" ? "..." : "Xong"}
          </button>
        ) : null}
        {status !== "COMPLETED" && status !== "CANCELED" ? (
          <button
            type="button"
            onClick={() => updateStatus("CANCELED")}
            disabled={loading !== ""}
            className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {loading === "CANCELED" ? "..." : "Hủy"}
          </button>
        ) : null}
      </div>

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
            user={orderData.user}
            isAdmin={true}
            onClose={() => setIsModalOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}
