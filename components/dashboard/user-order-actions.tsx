"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/shared/toast";
import { Eye, Pencil, RefreshCw } from "lucide-react";
import { Modal } from "@/components/shared/modal";
import { OrderDetailModalContent } from "@/components/shared/order-detail-modal-content";

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

export function UserOrderActions({
  orderId,
  status,
  complaintStatus,
  updatedAt,
  buttonClassName,
  hideViewDetails = false,
}: {
  orderId: number;
  status: string;
  complaintStatus?: string | null;
  updatedAt: Date;
  buttonClassName?: string;
  hideViewDetails?: boolean;
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isComplainModalOpen, setIsComplainModalOpen] = useState(false);
  const [complainReason, setComplainReason] = useState("");
  const [isComplaining, setIsComplaining] = useState(false);
  
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [editForm, setEditForm] = useState({
    phone: "",
    address: "",
    variant: "",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

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

  async function handleComplainSubmit() {
    if (!complainReason.trim() || complainReason.length < 5) {
      addToast("error", "Vui lòng nhập lý do dài ít nhất 5 ký tự.");
      return;
    }
    setIsComplaining(true);
    try {
      const response = await fetch(`/api/order/complain/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: complainReason }),
      });
      const data = await readApiResponse(response);
      if (!response.ok) {
        addToast("error", data.error || "Không thể gửi khiếu nại");
        return;
      }
      addToast("success", "Đã gửi khiếu nại thành công.");
      setIsComplainModalOpen(false);
      router.refresh();
    } catch {
      addToast("error", "Lỗi mạng khi gửi khiếu nại");
    } finally {
      setIsComplaining(false);
    }
  }

  async function fetchCurrentOrder() {
    const response = await fetch(`/api/order/list?id=${orderId}`);
    const data = await readApiResponse(response);
    if (!response.ok || !data.orders) {
      throw new Error(data.error || "Không thể tải thông tin đơn hàng");
    }

    const order = data.orders.find((o: any) => o.id === orderId);
    if (!order) {
      throw new Error("Không tìm thấy đơn hàng");
    }

    return mapOrderData(order);
  }

  async function handleViewDetails() {
    setIsLoadingDetails(true);
    try {
      const mapped = await fetchCurrentOrder();
      setOrderData(mapped);
      setIsModalOpen(true);
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "Lỗi khi tải chi tiết đơn hàng");
      console.error(error);
    } finally {
      setIsLoadingDetails(false);
    }
  }

  async function handleOpenEditModal() {
    setIsLoadingDetails(true);
    try {
      const mapped = await fetchCurrentOrder();
      if (mapped.status !== "PENDING") {
        addToast("error", "Đơn đã được duyệt, không thể chỉnh sửa.");
        return;
      }

      setEditForm({
        phone: mapped.phone,
        address: mapped.address,
        variant: mapped.variant || "",
      });
      setIsEditModalOpen(true);
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "Không thể mở form sửa đơn");
    } finally {
      setIsLoadingDetails(false);
    }
  }

  async function handleSaveEdit() {
    if (!editForm.variant.trim() || !editForm.phone.trim() || !editForm.address.trim()) {
      addToast("error", "Vui lòng nhập đầy đủ thông tin bắt buộc.");
      return;
    }

    setIsSavingEdit(true);
    try {
      const response = await fetch(`/api/order/update/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: editForm.phone,
          address: editForm.address,
          variant: editForm.variant,
        }),
      });

      const data = await readApiResponse(response);
      if (!response.ok) {
        addToast("error", data.error || "Không thể cập nhật đơn hàng.");
        return;
      }

      addToast("success", "Cập nhật đơn hàng thành công.");
      setIsEditModalOpen(false);
      router.refresh();
    } catch (error) {
      addToast("error", "Có lỗi khi cập nhật đơn hàng.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleUserCancel() {
    const confirmed = window.confirm("Bạn chắc chắn muốn hủy đơn này?");
    if (!confirmed) return;

    setIsCanceling(true);
    try {
      const response = await fetch(`/api/order/update/${orderId}`, {
        method: "DELETE",
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        addToast("error", data.error || "Không thể hủy đơn.");
        return;
      }

      addToast("success", "Hủy đơn thành công.");
      setIsEditModalOpen(false);
      router.refresh();
    } catch {
      addToast("error", "Có lỗi khi hủy đơn.");
    } finally {
      setIsCanceling(false);
    }
  }

  async function handleResetOrder() {
    const confirmed = window.confirm("Xác nhận đặt lại đơn hàng này? Số dư sẽ bị trừ lại tương ứng.");
    if (!confirmed) return;

    setIsResetting(true);
    try {
      const response = await fetch("/api/order/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        addToast("error", data.error || "Không thể đặt lại đơn hàng.");
        return;
      }

      addToast("success", "Đặt lại đơn hàng thành công! Đang chờ duyệt.");
      router.refresh();
    } catch {
      addToast("error", "Có lỗi khi đặt lại đơn hàng.");
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <>
      <div className="flex flex-row gap-2 flex-nowrap items-center">
        {!hideViewDetails && (
          <button
            type="button"
            onClick={handleViewDetails}
            disabled={isLoadingDetails}
            className={
              `rounded-xl bg-amber-600 hover:bg-amber-700 font-semibold text-white disabled:opacity-60 transition-colors inline-flex items-center gap-1.5 ${buttonClassName ?? 'px-3 py-2 text-xs'}`
            }
            title="Xem chi tiết"
          >
            {isLoadingDetails ? "..." : <><Eye size={14} /> Chi tiết</>}
          </button>
        )}
        {status === "PENDING" ? (
          <button
            type="button"
            onClick={handleOpenEditModal}
            disabled={isLoadingDetails || isCanceling}
            className={
              `rounded-xl bg-slate-700 hover:bg-slate-800 font-semibold text-white disabled:opacity-60 transition-colors inline-flex items-center gap-1.5 ${buttonClassName ?? 'px-3 py-2 text-xs'}`
            }
            title="Sửa thông tin đơn"
          >
            <Pencil size={13} /> Sửa đơn
          </button>
        ) : null}
        {status === "PENDING" ? (
          <button
            type="button"
            onClick={handleUserCancel}
            disabled={isCanceling || isLoadingDetails}
            className={
              `rounded-xl bg-rose-600 hover:bg-rose-700 font-semibold text-white disabled:opacity-60 transition-colors ${buttonClassName ?? 'px-3 py-2 text-xs'}`
            }
            title="Hủy đơn"
          >
            {isCanceling ? "..." : "Hủy đơn"}
          </button>
        ) : null}
        {status === "CANCELED" ? (
          <button
            type="button"
            onClick={handleResetOrder}
            disabled={isResetting || isLoadingDetails}
            className={
              `rounded-xl bg-emerald-600 hover:bg-emerald-700 font-semibold text-white disabled:opacity-60 transition-colors inline-flex items-center gap-1.5 ${buttonClassName ?? 'px-3 py-2 text-xs'}`
            }
            title="Đặt lại đơn hàng"
          >
            {isResetting ? "..." : <><RefreshCw size={13} /> Đặt lại</>}
          </button>
        ) : null}
        {status === "DELIVERED" && !complaintStatus && (new Date().getTime() - new Date(updatedAt).getTime() <= 3 * 24 * 60 * 60 * 1000) ? (
          <button
            type="button"
            onClick={() => setIsComplainModalOpen(true)}
            disabled={isLoadingDetails}
            className={
              `rounded-xl bg-orange-600 hover:bg-orange-700 font-semibold text-white disabled:opacity-60 transition-colors inline-flex items-center gap-1.5 ${buttonClassName ?? 'px-3 py-2 text-xs'}`
            }
            title="Khiếu nại (Trong 3 ngày)"
          >
             Khiếu nại
          </button>
        ) : null}
        {complaintStatus === "PENDING" ? (
           <span className="shrink-0 rounded-xl bg-orange-500/10 px-3 py-2 text-xs font-bold text-orange-700 dark:text-orange-400">
             ⏳ Đang xử lý khiếu nại
           </span>
        ) : null}
        {complaintStatus === "APPROVED" ? (
           <span className="shrink-0 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
             ✅ Đã hoàn tiền khiếu nại
           </span>
        ) : null}
        {complaintStatus === "REJECTED" ? (
           <span className="shrink-0 rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-700 dark:text-rose-400">
             ❌ Bị từ chối khiếu nại
           </span>
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
            isAdmin={false}
            responsibleAdmin={orderData.approvedByAdmin || null}
            onClose={() => setIsModalOpen(false)}
          />
        </Modal>
      )}

      {isEditModalOpen ? (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={`Chỉnh sửa đơn #${orderId}`}
          size="medium"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Bạn chỉ có thể chỉnh sửa thông tin đơn khi trạng thái là Chờ duyệt.
            </p>

            <label className="block space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">
              <span>Phân loại</span>
              <input
                value={editForm.variant}
                onChange={(e) => setEditForm((prev) => ({ ...prev, variant: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-amber-500"
              />
            </label>

            <label className="block space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">
              <span>Số điện thoại</span>
              <input
                value={editForm.phone}
                onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-amber-500"
              />
            </label>

            <label className="block space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">
              <span>Địa chỉ</span>
              <textarea
                value={editForm.address}
                onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-amber-500"
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                disabled={isSavingEdit}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 transition-colors hover:bg-amber-700"
                disabled={isSavingEdit}
              >
                {isSavingEdit ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {/* Complain Modal */}
      {isComplainModalOpen ? (
        <Modal
          isOpen={isComplainModalOpen}
          onClose={() => setIsComplainModalOpen(false)}
          title={`Khiếu nại đơn hàng #${orderId}`}
          size="medium"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Vui lòng nêu rõ lý do bạn muốn khiếu nại đơn hàng này. Yêu cầu của bạn sẽ được gửi lên Ban Quản Trị xem xét để hoàn tiền.
            </p>

            <label className="block space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">
              <span>Lý do khiếu nại (ít nhất 5 ký tự)</span>
              <textarea
                value={complainReason}
                onChange={(e) => setComplainReason(e.target.value)}
                rows={4}
                placeholder="Nhập lý do chi tiết..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-orange-500"
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsComplainModalOpen(false)}
                className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                disabled={isComplaining}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleComplainSubmit}
                className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 transition-colors hover:bg-orange-700"
                disabled={isComplaining}
              >
                {isComplaining ? "Đang gửi..." : "Gửi thông tin"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
