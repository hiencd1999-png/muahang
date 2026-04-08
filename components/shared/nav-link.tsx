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
        "rounded-2xl border px-4 py-3 text-sm font-semibold transition",
        active
          ? "border-amber-600 bg-amber-600 text-white shadow-lg shadow-amber-950/15"
          : "border-slate-200/70 bg-white/70 text-slate-700 hover:border-amber-300 hover:bg-amber-50",
      )}
    >
      {label}
    </Link>
  );
}
