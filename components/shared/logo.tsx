import Link from "next/link";

export function Logo({ className = "", href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 ${className}`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-md shadow-orange-500/30">
        <span className="text-xl font-black text-white">O</span>
      </div>
      <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
        Booking
      </span>
    </Link>
  );
}
