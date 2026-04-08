import { formatDate } from "@/lib/format";

interface TimelineEvent {
  status: string;
  timestamp?: Date;
}

interface OrderTimelineProps {
  currentStatus: string;
  createdAt: Date;
  updatedAt?: Date;
}

export function OrderTimeline({ currentStatus, createdAt, updatedAt }: OrderTimelineProps) {
  const statuses = ["PENDING", "PROCESSING", "COMPLETED", "CANCELED"];
  const currentIndex = statuses.indexOf(currentStatus);

  const events: TimelineEvent[] = [
    { status: "PENDING", timestamp: createdAt },
    { status: "PROCESSING", timestamp: currentIndex >= 1 ? updatedAt : undefined },
    { status: "COMPLETED", timestamp: currentIndex === 2 ? updatedAt : undefined },
    { status: "CANCELED", timestamp: currentStatus === "CANCELED" ? updatedAt : undefined },
  ];

  const statusColors: Record<string, { bg: string; border: string; text: string }> = {
    PENDING: { bg: "bg-sky-100", border: "border-sky-300", text: "text-sky-700" },
    PROCESSING: { bg: "bg-amber-100", border: "border-amber-300", text: "text-amber-700" },
    COMPLETED: { bg: "bg-emerald-100", border: "border-emerald-300", text: "text-emerald-700" },
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
                  <p className={`text-sm font-semibold ${colors.text}`}>{event.status}</p>
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