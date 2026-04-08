import Link from "next/link";
import { requireUser } from "@/lib/session";
import { NavLink } from "@/components/shared/nav-link";
import { LogoutButton } from "@/components/shared/logout-button";
import { MobileNav } from "@/components/shared/mobile-nav";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireUser("ADMIN");

  return (
    <main className="shell flex-1 py-6 sm:py-8">
      <header className="panel mb-6 flex flex-col gap-5 rounded-[2rem] p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between bg-white dark:bg-gray-900 border dark:border-gray-800">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-gray-400">Admin panel</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white sm:text-3xl">Điều phối user, đơn và giao dịch</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ThemeToggle />
          <Link href="/dashboard" className="rounded-full border border-slate-300 bg-white dark:bg-gray-800 dark:border-gray-700 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-gray-300 sm:px-4">
            Về dashboard
          </Link>
          <LogoutButton />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="panel rounded-[2rem] p-4 lg:block">
          <div className="hidden gap-2 lg:grid">
            <NavLink href="/admin" label="Tổng quan" />
            <NavLink href="/admin/users" label="Quản lý user" />
            <NavLink href="/admin/orders" label="Quản lý đơn" />
            <NavLink href="/admin/transactions" label="Transactions" />
            <NavLink href="/admin/logs" label="Nhật ký hoạt động" />
          </div>
          <MobileNav links={[
            { href: "/admin", label: "Tổng quan" },
            { href: "/admin/users", label: "Quản lý user" },
            { href: "/admin/orders", label: "Quản lý đơn" },
            { href: "/admin/transactions", label: "Transactions" },
            { href: "/admin/logs", label: "Nhật ký hoạt động" },
          ]} />
        </aside>
        <section className="space-y-6">{children}</section>
      </div>
    </main>
  );
}
