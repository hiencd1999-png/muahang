import { formatDate } from "@/lib/format";

interface TimelineEvent {
  status: string;
  label: string;
  timestamp?: Date;
}

interface OrderTimelineProps {
  currentStatus: string;
  createdAt: Date;
  updatedAt?: Date;
}

export function OrderTimeline({ currentStatus, createdAt, updatedAt }: OrderTimelineProps) {
  const statuses = ["PENDING", "PROCESSING", "ORDER_PLACED", "TRACKING_GENERATED", "DELIVERED", "CANCELED"];
  const currentIndex = statuses.indexOf(currentStatus);

  const statusLabels: Record<string, string> = {
    PENDING: "Chờ duyệt",
    PROCESSING: "Đang xử lý",
    ORDER_PLACED: "Đã đặt đơn",
    TRACKING_GENERATED: "Đã lên mã VĐ",
    DELIVERED: "Đã giao hàng",
    CANCELED: "Đã hủy",
  };

  // Build events array based on current status
  let events: TimelineEvent[] = [];

  if (currentStatus === "CANCELED") {
    // If canceled, show only PENDING and CANCELED
    events = [
      { status: "PENDING", label: statusLabels.PENDING, timestamp: createdAt },
      { status: "CANCELED", label: statusLabels.CANCELED, timestamp: updatedAt },
    ];
  } else {
    // Show events up to current status, excluding CANCELED
    const relevantStatuses = statuses.slice(0, currentIndex + 1);
    events = relevantStatuses.map((status, index) => ({
      status,
      label: statusLabels[status],
      timestamp: index === 0 ? createdAt : (index === currentIndex ? updatedAt : undefined),
    }));
  }

  const statusColors: Record<string, { bg: string; border: string; text: string }> = {
    PENDING: { bg: "bg-yellow-100", border: "border-yellow-300", text: "text-yellow-700" },
    PROCESSING: { bg: "bg-sky-100", border: "border-sky-300", text: "text-sky-700" },
    ORDER_PLACED: { bg: "bg-blue-100", border: "border-blue-300", text: "text-blue-700" },
    TRACKING_GENERATED: { bg: "bg-indigo-100", border: "border-indigo-300", text: "text-indigo-700" },
    DELIVERED: { bg: "bg-emerald-100", border: "border-emerald-300", text: "text-emerald-700" },
    CANCELED: { bg: "bg-rose-100", border: "border-rose-300", text: "text-rose-700" },
  };

  return (
    <div className="py-6">
      <h3 className="mb-4 text-sm font-semibold text-slate-950">Dòng thời gian đơn hàng</h3>
      <div className="space-y-4">
        {events.map((event, index) => {
          const isCompleted = statuses.indexOf(event.status) < currentIndex;
          const isCurrent = event.status === currentStatus;
          const colors = statusColors[event.status];

          return (
            <div key={event.status} className="flex gap-4">
              {/* Timeline dot */}
              <div className="flex flex-col items-center">
                <div
                  className={`h-4 w-4 rounded-full border-2 ${
                    isCurrent ? "scale-125 bg-amber-500 border-amber-600" : isCompleted ? "bg-emerald-500 border-emerald-600" : "bg-slate-300 border-slate-400"
                  }`}
                />
                {index < events.length - 1 && (
                  <div
                    className={`my-1 h-8 w-0.5 ${isCompleted || isCurrent ? "bg-emerald-500" : "bg-slate-300"}`}
                  />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-4">
                <div className={`rounded-lg border-2 ${colors.border} ${colors.bg} px-3 py-2`}>
                  <p className={`text-sm font-semibold ${colors.text}`}>{event.label}</p>
                  {event.timestamp && (
                    <p className={`text-xs ${colors.text} opacity-75`}>{formatDate(event.timestamp)}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}