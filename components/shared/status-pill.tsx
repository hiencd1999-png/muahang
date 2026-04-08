import clsx from "clsx";
import { statusLabel } from "@/lib/format";

const statusStyles: Record<string, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  PROCESSING: "border-sky-200 bg-sky-50 text-sky-800",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  CANCELED: "border-rose-200 bg-rose-50 text-rose-800",
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
