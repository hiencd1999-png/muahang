import * as XLSX from "xlsx";

interface ExportOrderRow {
  id: number;
  username?: string;
  productName: string;
  productLink: string;
  shopId: string | null;
  variant?: string | null;
  phone?: string | null;
  address?: string | null;
  note?: string | null;
  quantity: number;
  total: number;
  status: string;
  cancelReason?: string | null;
  spcCookie?: string | null;
  trackingNo?: string | null;
  createdAt: Date;
}

interface BuildWorkbookOptions {
  includeDetailFields?: boolean;
  includeNoteField?: boolean;
  includeAdminFields?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Chờ duyệt",
  PROCESSING: "Đang xử lý",
  ORDER_PLACED: "Đã đặt đơn",
  TRACKING_GENERATED: "Đã lên mã VĐ",
  DELIVERED: "Đã giao hàng",
  CANCELED: "Đã hủy",
};

export function buildOrdersWorkbookBuffer(orders: ExportOrderRow[], options: BuildWorkbookOptions = {}) {
  const rows = orders.map((order) => {
    const baseRow: Record<string, string | number> = {
      "Mã đơn": order.id,
      "Username": order.username || "",
      "Sản phẩm": order.productName,
      "Link Shopee": order.productLink,
      "Shop ID": order.shopId || "",
      "Phân loại": order.variant || "",
      "Số lượng": order.quantity,
      "Tổng tiền (VND)": order.total,
      "Trạng thái": STATUS_LABELS[order.status] || order.status,
      "Lý do hủy": order.cancelReason || "",
      "Ngày tạo": new Date(order.createdAt).toLocaleString("vi-VN"),
    };

    if (options.includeDetailFields || options.includeAdminFields) {
      baseRow["Số điện thoại"] = order.phone || "";
      baseRow["Địa chỉ"] = order.address || "";
      baseRow["Mã vận đơn"] = order.trackingNo || "";
    }

    if (options.includeNoteField || options.includeAdminFields) {
      baseRow["Ghi chú"] = order.note || "";
    }

    if (options.includeAdminFields) {
      baseRow["Cookie SPC_ST"] = order.spcCookie || "";
    }

    return baseRow;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");

  return XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  });
}
