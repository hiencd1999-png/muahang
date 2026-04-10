import Link from "next/link";
import { requireUser } from "@/lib/session";
import { NavLink } from "@/components/shared/nav-link";
import { LogoutButton } from "@/components/shared/logout-button";
import { MobileNav } from "@/components/shared/mobile-nav";
import { NotificationBell } from "@/components/shared/notification-bell";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { formatCurrency } from "@/lib/format";
import { isAdminRole } from "@/lib/roles";

import { Logo } from "@/components/shared/logo";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <main className="shell flex-1 py-6 sm:py-8">
      <header className="panel relative z-40 mb-6 rounded-[2rem] p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 min-w-0">
            <div className="mb-4">
              <Logo />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 dark:text-slate-100 mb-1 opacity-80">User dashboard</p>
            <h1 className="text-2xl font-black text-slate-950 dark:text-white sm:text-3xl truncate tracking-tight">Xin chào, {user.fullName || user.username}</h1>
            
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="inline-flex flex-col rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 border border-amber-200/60 dark:border-amber-900/40 px-5 py-3 shadow-md">
                <p className="text-[10px] text-amber-700 dark:text-white font-black uppercase tracking-widest opacity-90">Số dư hiện tại</p>
                <p className="text-xl font-black text-amber-950 dark:text-white mt-1">{formatCurrency(user.balance)}</p>
              </div>

              <div className="flex items-center gap-2">
                <NotificationBell />
                <ThemeToggle />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-slate-100 dark:border-slate-700/80 pt-5 lg:border-0 lg:pt-0">
            {isAdminRole(user.role) ? (
              <Link
                href="/admin"
                className="flex-1 text-center rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/40 px-4 py-2.5 text-sm font-bold text-amber-900 dark:text-amber-300 transition hover:bg-amber-100 dark:hover:bg-amber-900/60 sm:flex-none"
              >
                Vào admin
              </Link>
            ) : null}
            <div className="flex-1 lg:flex-none">
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="panel rounded-[2rem] p-4 lg:block">
          <div className="hidden gap-2 lg:grid">
            <NavLink href="/dashboard" label="Tổng quan" />
            <NavLink href="/dashboard/deposit" label="Nạp tiền" />
            <NavLink href="/dashboard/create-order" label="Tạo đơn" />
            <NavLink href="/dashboard/orders" label="Lịch sử đơn" />
            <NavLink href="/dashboard/transactions" label="Lịch sử giao dịch" />
            <NavLink href="/dashboard/profile" label="Profile" />
          </div>
          <MobileNav links={[
            { href: "/dashboard", label: "Tổng quan" },
            { href: "/dashboard/deposit", label: "Nạp tiền" },
            { href: "/dashboard/create-order", label: "Tạo đơn" },
            { href: "/dashboard/orders", label: "Lịch sử đơn" },
            { href: "/dashboard/transactions", label: "Lịch sử giao dịch" },
            { href: "/dashboard/profile", label: "Profile" },
          ]} />
        </aside>
        <section className="space-y-6 min-w-0">{children}</section>
      </div>
    </main>
  );
}
