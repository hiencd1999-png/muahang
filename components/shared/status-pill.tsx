import clsx from "clsx";
import { statusLabel } from "@/lib/format";

const statusStyles: Record<string, string> = {
  PENDING: "border-yellow-200 dark:border-yellow-900/30 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400",
  PROCESSING: "border-sky-200 dark:border-sky-900/30 bg-sky-50 dark:bg-sky-900/20 text-sky-800 dark:text-sky-300",
  ORDER_PLACED: "border-blue-200 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300",
  TRACKING_GENERATED: "border-indigo-200 dark:border-indigo-900/30 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300",
  DELIVERED: "border-emerald-200 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-400",
  CANCELED: "border-rose-200 dark:border-rose-900/30 bg-rose-50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-400",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        statusStyles[status] ?? "border-slate-200 bg-slate-50 text-slate-700",
      )}
    >
      {statusLabel(status)}
    </span>
  );
}
