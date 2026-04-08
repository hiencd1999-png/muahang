import { Skeleton } from "@/components/shared/skeleton";

export default function Loading() {
  return (
    <section className="panel rounded-[1.75rem] p-4 sm:p-6">
      <div className="mb-6 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-96" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </section>
  );
}
