"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/shared/toast";

export function BatchActionsToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearAll,
  actionType = "orders",
}: {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearAll: () => void;
  actionType?: "orders" | "users" | "transactions";
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const handleBatchAction = async () => {
    if (!action || selectedCount === 0) return;

    setLoading(true);

    try {
      let endpoint = "";
      let body = {};

      if (actionType === "orders" && action.startsWith("status_")) {
        endpoint = "/api/admin/orders/batch-update";
        const status = action.split("_")[1].toUpperCase();
        body = { orderIds: selectedIds, status };
      } else if (actionType === "users" && action.startsWith("balance_")) {
        endpoint = "/api/admin/users/batch-balance";
        const amountChange = parseInt(action.split("_")[1]);
        body = { userIds: selectedIds, amountChange };
      }

      if (!endpoint) {
        addToast("error", "Invalid action");
        setLoading(false);
        return;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        addToast("error", result.error || "Thao tác thất bại");
      } else {
        addToast("success", result.message);
        setAction("");
        onClearAll();
        router.refresh();
      }
    } catch (error) {
      addToast("error", "Lỗi khi thực hiện thao tác");
      console.error(error);
    } finally {
      setLoading(false);
      setShowModal(false);
    }
  };

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="sticky bottom-0 left-0 right-0 border-t border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-4">
      <div className="text-sm font-medium text-amber-900">
        {selectedCount} / {totalCount} được chọn
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={selectedCount === totalCount ? onClearAll : onSelectAll}
          className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-50"
        >
          {selectedCount === totalCount ? "Bỏ chọn tất cả" : "Chọn tất cả"}
        </button>

        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            if (e.target.value) setShowModal(true);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
        >
          <option value="">-- Chọn thao tác --</option>
          {actionType === "orders" && (
            <>
              <option value="status_pending">Đặt lại Chờ xử lý</option>
              <option value="status_processing">Đổi thành Đang xử lý</option>
              <option value="status_completed">Đánh dấu Hoàn thành</option>
              <option value="status_canceled">Hủy đơn</option>
            </>
          )}
          {actionType === "users" && (
            <>
              <option value="balance_100000">Cộng 100k</option>
              <option value="balance_250000">Cộng 250k</option>
              <option value="balance_-100000">Trừ 100k</option>
              <option value="balance_-250000">Trừ 250k</option>
            </>
          )}
        </select>
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-lg bg-white p-6 max-w-sm">
            <h3 className="text-lg font-semibold text-slate-900">Xác nhận thao tác</h3>
            <p className="mt-2 text-sm text-slate-600">
              Bạn sắp thực hiện thao tác trên {selectedCount} mục. Hành động này không thể hoàn tác.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setAction("");
                }}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleBatchAction}
                disabled={loading}
                className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                {loading ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
