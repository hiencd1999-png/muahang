import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CreditCard, LayoutDashboard, ShieldCheck, ShoppingBag } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getPostLoginRedirect } from "@/lib/roles";

const flowSteps = [
  "Đăng ký / đăng nhập",
  "Vào dashboard để xem số dư và đơn gần đây",
  "Nạp tiền hoặc tạo đơn Shopee",
  "Admin xử lý và cập nhật trạng thái",
  "User nhận kết quả hoàn tất",
];

const siteMap = [
  "/login",
  "/register",
  "/dashboard",
  "/dashboard/deposit",
  "/dashboard/create-order",
  "/dashboard/orders",
  "/dashboard/profile",
  "/admin",
  "/admin/users",
  "/admin/orders",
  "/admin/transactions",
];

export default async function Home() {
  const user = await getCurrentUser();

  if (user) {
    redirect(getPostLoginRedirect(user.role));
  }

  return (
    <main className="hero-grid flex-1 py-8 sm:py-12">
      <div className="shell grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="panel animate-rise rounded-[2rem] p-8 sm:p-10">
          <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-amber-800">
            DatDon Shopee System
          </span>
          <h1 className="mt-6 max-w-2xl text-4xl font-semibold leading-tight text-slate-950 sm:text-6xl">
            Hệ thống <span className="text-gradient">đặt đơn Shopee</span> với luồng user và admin tách bạch.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
            Nạp tiền, tạo đơn, theo dõi trạng thái xử lý và quản trị balance ngay trong một dashboard thống nhất.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Bắt đầu ngay <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
            >
              Đăng nhập
            </Link>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <article className="rounded-[1.5rem] bg-white/70 p-5">
              <CreditCard className="h-5 w-5 text-amber-700" />
              <p className="mt-4 text-sm text-slate-500">Nạp tiền</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">Tăng balance tức thì</p>
            </article>
            <article className="rounded-[1.5rem] bg-white/70 p-5">
              <ShoppingBag className="h-5 w-5 text-teal-700" />
              <p className="mt-4 text-sm text-slate-500">Tạo đơn</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">Validate link Shopee</p>
            </article>
            <article className="rounded-[1.5rem] bg-white/70 p-5">
              <ShieldCheck className="h-5 w-5 text-slate-700" />
              <p className="mt-4 text-sm text-slate-500">Admin panel</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">Quản lý user, đơn, giao dịch</p>
            </article>
          </div>
        </section>

        <section className="grid gap-6">
          <div className="panel rounded-[2rem] p-6">
            <div className="flex items-center gap-3">
              <LayoutDashboard className="h-5 w-5 text-slate-900" />
              <h2 className="text-lg font-semibold text-slate-900">Sơ đồ luồng</h2>
            </div>
            <ol className="mt-5 space-y-3 text-sm leading-7 text-slate-700">
              {flowSteps.map((step, index) => (
                <li key={step} className="flex gap-3 rounded-2xl bg-white/75 px-4 py-3">
                  <span className="font-mono text-xs text-amber-700">0{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="panel rounded-[2rem] p-6">
            <h2 className="text-lg font-semibold text-slate-900">Site map chính</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {siteMap.map((item) => (
                <span key={item} className="rounded-full border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-700">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
