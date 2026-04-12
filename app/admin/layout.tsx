import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getLockedAdminCommission } from "@/lib/admin-balance";
import { NavLink } from "@/components/shared/nav-link";
import { LogoutButton } from "@/components/shared/logout-button";
import { MobileNav } from "@/components/shared/mobile-nav";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { isSpAdminRole } from "@/lib/roles";

import { Logo } from "@/components/shared/logo";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const currentAdmin = await requireUser("ADMIN");
  const canManageVouchers = isSpAdminRole(currentAdmin.role);
  const canViewTransactions = isSpAdminRole(currentAdmin.role);
  const canManageProxies = isSpAdminRole(currentAdmin.role);
  const lockedCommission = isSpAdminRole(currentAdmin.role) ? 0 : await getLockedAdminCommission(currentAdmin.id);

    const navLinks = [
    { href: "/admin", label: "Tổng quan" },
    { href: "/admin/policies", label: "Cẩm nang & Chính sách" },
    { href: "/admin/users", label: "Quản lý user" },
    { href: "/admin/orders", label: "Quản lý đơn" },
    { href: "/admin/bank-deposits", label: "Bank (Nội Bộ)" },
    ...(isSpAdminRole(currentAdmin.role) ? [{ href: "/admin/system-banks", label: "Quản lý Cổng Bank" }] : []),
    ...(canManageVouchers ? [{ href: "/admin/vouchers", label: "Cấu hình voucher" }] : []),
    ...(canManageProxies ? [{ href: "/admin/proxies", label: "Proxy hệ thống" }] : []),
    ...(canViewTransactions ? [{ href: "/admin/transactions", label: "Giao dịch hệ thống" }] : []),
    ...(canViewTransactions ? [{ href: "/admin/crypto-deposits", label: "Crypto (USDT)" }] : []),
    ...(isSpAdminRole(currentAdmin.role) ? [{ href: "/admin/admin-requests", label: "Yêu cầu làm Admin" }] : []),
    ...(isSpAdminRole(currentAdmin.role) ? [{ href: "/admin/settings", label: "Cấu hình hệ thống" }] : []),
    { href: "/admin/withdrawals", label: "Rút tiền USDT" },
    { href: "/admin/analytics", label: "Phân tích - Thống kê" },
    { href: "/admin/logs", label: "Nhật ký hoạt động" },
  ];

  return (
    <main className="shell flex-1 py-6 sm:py-8">
      <header className="panel relative z-40 mb-6 flex flex-col gap-5 rounded-[2rem] p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between border-slate-200 dark:border-zinc-800">
        <div>
          <div className="mb-4">
            <Logo />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-zinc-400">Admin panel</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white sm:text-3xl">Điều phối user, đơn và giao dịch</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-3 hidden items-center rounded-2xl bg-slate-100 dark:bg-zinc-800/80 px-4 py-2 sm:flex">
             <div className="flex flex-col items-end mr-3">
                 <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase">Khả Dụng</span>
                 <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                   {new Intl.NumberFormat("vi-VN").format(Math.max(0, currentAdmin.balance - lockedCommission))} đ
                 </span>
             </div>
             {lockedCommission > 0 && (
               <div className="flex flex-col items-start pl-3 border-l border-slate-300 dark:border-zinc-700">
                 <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-500 uppercase">Tạm Giữ</span>
                 <span className="text-xs font-bold text-amber-700 dark:text-amber-400" title="Hoa hồng đang bị tạm giữ 3 ngày chờ hết hạn khiếu nại">
                   {new Intl.NumberFormat("vi-VN").format(lockedCommission)} đ
                 </span>
               </div>
             )}
          </div>
          <ThemeToggle />
          <Link href="/dashboard" className="rounded-full border border-slate-300 bg-white dark:bg-zinc-800/50 dark:border-zinc-700 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-zinc-300 sm:px-4 hover:bg-slate-50 dark:hover:bg-zinc-800 transition">
            Về dashboard
          </Link>
          <LogoutButton />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="panel rounded-[2rem] p-4 lg:block">
          <div className="hidden gap-2 lg:grid">
            {navLinks.map((link) => (
              <NavLink key={link.href} href={link.href} label={link.label} />
            ))}
          </div>
          <MobileNav links={navLinks} />
        </aside>
        <section className="min-w-0 space-y-6">{children}</section>
      </div>
    </main>
  );
}
