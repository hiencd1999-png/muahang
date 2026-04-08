"use client";

import { useState } from "react";
import { NavLink } from "@/components/shared/nav-link";

export function MobileNav({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 transition active:scale-[0.98]"
      >
        <span>Menu</span>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={open ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
        </svg>
      </button>
      {open && (
        <div className="mt-2 grid gap-2" onClick={() => setOpen(false)}>
          {links.map((link) => (
            <NavLink key={link.href} href={link.href} label={link.label} />
          ))}
        </div>
      )}
    </div>
  );
}