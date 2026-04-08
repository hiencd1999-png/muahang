import Link from "next/link";
import { requireUser } from "@/lib/session";
import { NavLink } from "@/components/shared/nav-link";
import { LogoutButton } from "@/components/shared/logout-button";
import { MobileNav } from "@/components/shared/mobile-nav";
import { NotificationBell } from "@/components/shared/notification-bell";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { formatCurrency } from "@/lib/format";
import { isAdminRole } from "@/lib/roles";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <main className="shell flex-1 py-6 sm:py-8">
      <header className="panel relative z-40 mb-6 flex flex-col gap-5 rounded-[2rem] p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between bg-white dark:bg-gray-900 border dark:border-gray-800">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-gray-400">User dashboard</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white sm:text-3xl">Xin chào, {user.fullName || user.username}</h1>
          <div className="mt-3 inline-block rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900 dark:to-orange-900 border border-amber-200 dark:border-amber-800 px-4 py-2">
            <p className="text-xs text-amber-700 dark:text-amber-200 font-medium">Số dư</p>
            <p className="text-lg font-bold text-amber-900 dark:text-amber-50">{formatCurrency(user.balance)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <NotificationBell />
          <ThemeToggle />
          {isAdminRole(user.role) ? (
            <Link
              href="/admin"
              className="rounded-full border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 sm:px-4"
            >
              Vào admin
            </Link>
          ) : null}
          <LogoutButton />
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
        <section className="space-y-6">{children}</section>
      </div>
    </main>
  );
}
