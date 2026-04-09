"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/shared/toast";
import { Eye } from "lucide-react";
import { Modal } from "@/components/shared/modal";
import { OrderDetailModalContent } from "@/components/shared/order-detail-modal-content";

interface OrderData {
  id: number;
  approvedByAdminId?: number | null;
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
  user?: {
    username: string;
    email: string;
    phone: string;
  };
  approvedByAdmin?: {
    id: number;
    username: string;
    fullName?: string;
  } | null;
}

interface AssignableAdmin {
  id: number;
  username: string;
  fullName: string | null;
  role: "ADMIN" | "SPADMIN";
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

export function OrderActions({
  orderId,
  status,
  currentAdminId,
  canManageAllOrders,
  approvedByAdminId,
  approvedByAdminName,
  assignableAdmins,
}: {
  orderId: number;
  status: string;
  currentAdminId: number;
  canManageAllOrders: boolean;
  approvedByAdminId: number | null;
  approvedByAdminName: string | null;
  assignableAdmins: AssignableAdmin[];
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [showCookieModal, setShowCookieModal] = useState(false);
  const [spcCookie, setSpcCookie] = useState("");
  const [isCookieLoading, setIsCookieLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelLoading, setIsCancelLoading] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAdminId, setSelectedAdminId] = useState<number | "">(approvedByAdminId ?? "");
  const [isAssignLoading, setIsAssignLoading] = useState(false);
  const isDeliveredOrder = status === "DELIVERED";
  const isOwnedByAnotherAdmin =
    !canManageAllOrders && approvedByAdminId !== null && approvedByAdminId !== currentAdminId;
  const ownershipMessage = approvedByAdminName
    ? `Đơn này đang do admin ${approvedByAdminName} phụ trách.`
    : "Đơn này chưa có admin phụ trách.";

  async function readApiResponse(response: Response) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }

    const text = await response.text();
    return { error: text?.slice(0, 120) || "Phản hồi không hợp lệ từ server." };
  }

  async function updateStatus(nextStatus: string, cookie?: string, reason?: string) {
    setLoading(nextStatus);

    const payload: any = { orderId, status: nextStatus };
    if (cookie) {
      payload.spcCookie = cookie;
    }
    if (reason) {
      payload.cancelReason = reason;
    }

    const response = await fetch("/api/admin/order/update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await readApiResponse(response);

    if (response.ok) {
      addToast("success", "Cập nhật trạng thái thành công!");
      setSpcCookie("");
      setShowCookieModal(false);
      setCancelReason("");
      setShowCancelModal(false);
      router.refresh();
    } else {
      addToast("error", data.error ?? "Cập nhật thất bại.");
    }

    setLoading("");
    setIsCookieLoading(false);
  }

  async function handleViewDetails() {
    setIsLoadingDetails(true);
    try {
      const response = await fetch(`/api/admin/order/${orderId}`);
      const data = await readApiResponse(response);

      if (response.ok && data.order) {
        const order = data.order;
        setOrderData({
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
          status: order.status,
          spcCookie: order.spcCookie,
          trackingNo: order.trackingNo,
          shopeeTrackingData: order.shopeeTrackingData,
          approvedByAdminId: order.approvedByAdminId,
          createdAt: new Date(order.createdAt),
          updatedAt: new Date(order.updatedAt),
          userId: order.userId,
          user: order.user,
          approvedByAdmin: order.approvedByAdmin,
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

  const handleCancelClick = () => {
    setShowCancelModal(true);
  };

  const handleCookieSubmit = async () => {
    if (!spcCookie.trim()) {
      addToast("error", "Vui lòng nhập cookie SPC_ST");
      return;
    }
    setIsCookieLoading(true);
    await updateStatus("ORDER_PLACED", spcCookie);
  };

  const handleCancelSubmit = async () => {
    if (!cancelReason.trim()) {
      addToast("error", "Vui lòng nhập lý do hủy đơn.");
      return;
    }
    setIsCancelLoading(true);
    await updateStatus("CANCELED", undefined, cancelReason.trim());
    setIsCancelLoading(false);
  };

  const handleOpenAssignModal = () => {
    if (isDeliveredOrder) {
      addToast("error", "Đơn đã giao không thể đổi phụ trách.");
      return;
    }

    setSelectedAdminId(approvedByAdminId ?? assignableAdmins[0]?.id ?? "");
    setShowAssignModal(true);
  };

  const handleAssignSubmit = async () => {
    if (!selectedAdminId) {
      addToast("error", "Vui lòng chọn admin phụ trách.");
      return;
    }

    setIsAssignLoading(true);

    try {
      const response = await fetch("/api/admin/order/reassign", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, adminId: selectedAdminId }),
      });

      const data = await readApiResponse(response);

      if (!response.ok) {
        addToast("error", data.error ?? "Không thể đổi admin phụ trách.");
        return;
      }

      addToast("success", "Đã cập nhật admin phụ trách.");
      setShowAssignModal(false);
      router.refresh();
    } catch {
      addToast("error", "Có lỗi khi đổi admin phụ trách.");
    } finally {
      setIsAssignLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 whitespace-nowrap overflow-x-auto">
        <button
          type="button"
          onClick={handleViewDetails}
          disabled={isLoadingDetails}
          className="shrink-0 rounded-xl bg-slate-500 hover:bg-slate-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 transition-colors flex items-center gap-1"
          title="Xem chi tiết"
        >
          {isLoadingDetails ? "..." : <><Eye size={14} /> Chi tiết</>}
        </button>
        {status === "PENDING" ? (
          <button
            type="button"
            onClick={() => updateStatus("PROCESSING")}
            disabled={loading !== "" || isOwnedByAnotherAdmin || (approvedByAdminId !== null && approvedByAdminId !== currentAdminId)}
            className="shrink-0 rounded-xl bg-sky-600 hover:bg-sky-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 transition-colors"
            title={(approvedByAdminId !== null && approvedByAdminId !== currentAdminId) ? "Đơn đã được Booking cho người khác. Không thể tranh." : isOwnedByAnotherAdmin ? ownershipMessage : "Duyệt đơn"}
          >
            {loading === "PROCESSING" ? "..." : "Duyệt"}
          </button>
        ) : null}
        {status === "PROCESSING" ? (
          <button
            type="button"
            onClick={handleOrderPlacedClick}
            disabled={loading !== "" || isOwnedByAnotherAdmin}
            className="shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 transition-colors"
            title={isOwnedByAnotherAdmin ? ownershipMessage : "Đặt đơn"}
          >
            {loading === "ORDER_PLACED" ? "..." : "Đặt đơn"}
          </button>
        ) : null}
        {status === "ORDER_PLACED" ? (
          <span className="shrink-0 rounded-xl bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
            Đang chờ hệ thống tự lên mã VĐ...
          </span>
        ) : null}
        {status === "TRACKING_GENERATED" ? (
          <span className="shrink-0 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Hệ thống đang tự theo dõi hành trình...
          </span>
        ) : null}
        {status !== "DELIVERED" && status !== "CANCELED" ? (
          <button
            type="button"
            onClick={handleCancelClick}
            disabled={loading !== "" || isOwnedByAnotherAdmin}
            className="shrink-0 rounded-xl bg-rose-600 hover:bg-rose-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 transition-colors"
            title={isOwnedByAnotherAdmin ? ownershipMessage : "Hủy đơn"}
          >
            {loading === "CANCELED" ? "..." : "Hủy"}
          </button>
        ) : null}
        {canManageAllOrders ? (
          <button
            type="button"
            onClick={handleOpenAssignModal}
            disabled={isAssignLoading || assignableAdmins.length === 0 || isDeliveredOrder}
            className="shrink-0 rounded-xl bg-violet-600 hover:bg-violet-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 transition-colors"
            title={isDeliveredOrder ? "Đơn đã giao không thể đổi phụ trách" : "Đổi admin phụ trách"}
          >
            Đổi phụ trách
          </button>
        ) : null}
      </div>
      {isOwnedByAnotherAdmin ? (
        <p className="mt-2 text-xs font-medium text-amber-700">{ownershipMessage}</p>
      ) : null}

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
            currentAdminId={currentAdminId}
            canManageAllOrders={canManageAllOrders}
            responsibleAdmin={orderData.approvedByAdmin || null}
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

      {showCancelModal && (
        <Modal
          isOpen={showCancelModal}
          onClose={() => {
            setShowCancelModal(false);
            setCancelReason("");
          }}
          title="Lý do hủy đơn"
          size="medium"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Lý do này sẽ hiển thị cho user trong chi tiết đơn hàng.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Nhập lý do hủy đơn..."
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason("");
                }}
                className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-sm"
                disabled={isCancelLoading}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleCancelSubmit}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm disabled:opacity-60"
                disabled={isCancelLoading || !cancelReason.trim()}
              >
                {isCancelLoading ? "Đang xử lý..." : "Xác nhận hủy"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showAssignModal && (
        <Modal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          title="Đổi admin phụ trách"
          size="medium"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              SPADMIN có thể chuyển đơn này cho admin khác. Nếu đơn đang chờ duyệt, hệ thống sẽ tự chuyển sang "Đang xử lý".
            </p>

            <label className="space-y-2 text-sm font-medium text-slate-700 block">
              <span>Admin phụ trách mới</span>
              <select
                value={selectedAdminId}
                onChange={(event) => setSelectedAdminId(event.target.value ? Number(event.target.value) : "")}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
              >
                <option value="">Chọn admin</option>
                {assignableAdmins.map((admin) => (
                  <option key={admin.id} value={admin.id}>
                    {admin.username + (admin.role === "SPADMIN" ? " (SPADMIN)" : "")}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">Danh sách hiển thị theo username admin.</p>
            </label>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="rounded-xl bg-slate-200 hover:bg-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                disabled={isAssignLoading}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleAssignSubmit}
                className="rounded-xl bg-violet-600 hover:bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={isAssignLoading || !selectedAdminId}
              >
                {isAssignLoading ? "Đang cập nhật..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
