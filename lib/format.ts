export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function statusLabel(status: string) {
  switch (status) {
    case "PENDING":
      return "Chờ duyệt";
    case "PROCESSING":
      return "Đang xử lý";
    case "ORDER_PLACED":
      return "Đã đặt đơn";
    case "TRACKING_GENERATED":
      return "Đã lên VĐ";
    case "DELIVERED":
      return "Đã giao";
    case "CANCELED":
      return "Đã hủy";
    default:
      return status;
  }
}
