"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

type NavLinkProps = {
  href: string;
  label: string;
};

export function NavLink({ href, label }: NavLinkProps) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={clsx(
        "rounded-2xl border px-4 py-3 text-sm font-semibold transition active:scale-[0.98]",
        active
          ? "border-amber-600 bg-amber-600 text-white shadow-lg shadow-amber-950/20"
          : "border-slate-200/70 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 hover:border-amber-400/50 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-700 dark:hover:text-amber-100",
      )}
    >
      {label}
    </Link>
  );
}
