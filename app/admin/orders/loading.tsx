import { CardSkeleton } from "@/components/shared/skeleton";

export default function Loading() {
  return (
    <div className="panel rounded-[1.75rem] p-4 sm:p-6">
      <div className="mb-5 h-6 w-32 animate-pulse rounded bg-slate-200" />
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}