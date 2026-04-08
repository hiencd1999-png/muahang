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
  status: "PENDING" | "PROCESSING" | "ORDER_PLACED" | "TRACKING_GENERATED" | "DELIVERED" | "CANCELED";
  spcCookie?: string;
  trackingNo?: string;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
  user?: {
    username: string;
    email: string;
    phone: string;
  };
}

const statusLabels: Record<string, string> = {
  PENDING: "Chờ duyệt",
  PROCESSING: "Đang xử lý",
  ORDER_PLACED: "Đã đặt đơn",
  TRACKING_GENERATED: "Đã lên mã vận đơn",
  DELIVERED: "Đã giao hàng",
  CANCELED: "Đã hủy",
};

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-600 hover:bg-yellow-700",
  PROCESSING: "bg-sky-600 hover:bg-sky-700",
  ORDER_PLACED: "bg-blue-600 hover:bg-blue-700",
  TRACKING_GENERATED: "bg-indigo-600 hover:bg-indigo-700",
  DELIVERED: "bg-emerald-600 hover:bg-emerald-700",
  CANCELED: "bg-rose-600 hover:bg-rose-700",
};

export function OrderActions({ orderId, status }: { orderId: number; status: string }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [showCookieModal, setShowCookieModal] = useState(false);
  const [spcCookie, setSpcCookie] = useState("");
  const [isCookieLoading, setIsCookieLoading] = useState(false);

  async function updateStatus(nextStatus: string, cookie?: string) {
    setLoading(nextStatus);

    const payload: any = { orderId, status: nextStatus };
    if (cookie) {
      payload.spcCookie = cookie;
    }

    const response = await fetch("/api/admin/order/update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      addToast("success", "Cập nhật trạng thái thành công!");
      setSpcCookie("");
      setShowCookieModal(false);
      router.refresh();
    } else {
      const data = await response.json();
      addToast("error", data.error ?? "Cập nhật thất bại.");
    }

    setLoading("");
    setIsCookieLoading(false);
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
          spcCookie: order.spcCookie,
          trackingNo: order.trackingNo,
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

  const handleOrderPlacedClick = () => {
    setShowCookieModal(true);
  };

  const handleCookieSubmit = async () => {
    if (!spcCookie.trim()) {
      addToast("error", "Vui lòng nhập cookie SPC_ST");
      return;
    }
    setIsCookieLoading(true);
    await updateStatus("ORDER_PLACED", spcCookie);
  };

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
            className="rounded-xl bg-sky-600 hover:bg-sky-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 transition-colors"
          >
            {loading === "PROCESSING" ? "..." : "Duyệt"}
          </button>
        ) : null}
        {status === "PROCESSING" ? (
          <button
            type="button"
            onClick={handleOrderPlacedClick}
            disabled={loading !== ""}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 transition-colors"
          >
            {loading === "ORDER_PLACED" ? "..." : "Đặt đơn"}
          </button>
        ) : null}
        {status === "ORDER_PLACED" ? (
          <button
            type="button"
            onClick={() => updateStatus("TRACKING_GENERATED")}
            disabled={loading !== ""}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 transition-colors"
          >
            {loading === "TRACKING_GENERATED" ? "..." : "Lên mã VĐ"}
          </button>
        ) : null}
        {status === "TRACKING_GENERATED" ? (
          <button
            type="button"
            onClick={() => updateStatus("DELIVERED")}
            disabled={loading !== ""}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 transition-colors"
          >
            {loading === "DELIVERED" ? "..." : "Giao hàng"}
          </button>
        ) : null}
        {status !== "DELIVERED" && status !== "CANCELED" ? (
          <button
            type="button"
            onClick={() => updateStatus("CANCELED")}
            disabled={loading !== ""}
            className="rounded-xl bg-rose-600 hover:bg-rose-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 transition-colors"
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

      {/* Cookie Modal for ORDER_PLACED transition */}
      {showCookieModal && (
        <Modal
          isOpen={showCookieModal}
          onClose={() => {
            setShowCookieModal(false);
            setSpcCookie("");
          }}
          title="Cung cấp Cookie SPC_ST"
          size="medium"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Cookie SPC_ST:
              </label>
              <textarea
                value={spcCookie}
                onChange={(e) => setSpcCookie(e.target.value)}
                placeholder="Dán cookie SPC_ST tại đây (ví dụ: SPC_ST=...)"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                rows={4}
              />
              <p className="text-xs text-slate-500 mt-2">
                Cookie này được sử dụng để đặt đơn hàng trên Shopee. Không chia sẻ cookie này với ai.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowCookieModal(false);
                  setSpcCookie("");
                }}
                className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-sm transition-colors"
                disabled={isCookieLoading}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleCookieSubmit}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors disabled:opacity-60"
                disabled={isCookieLoading || !spcCookie.trim()}
              >
                {isCookieLoading ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
