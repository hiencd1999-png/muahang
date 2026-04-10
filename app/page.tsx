import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Wallet, ShoppingBag, Truck, Zap, ShieldCheck, Clock } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getPostLoginRedirect } from "@/lib/roles";

import { Logo } from "@/components/shared/logo";

export default async function Home() {
  const user = await getCurrentUser();

  if (user) {
    redirect(getPostLoginRedirect(user.role));
  }

  return (
    <main className="flex-1 flex flex-col items-center pt-10 sm:pt-20 pb-20 overflow-hidden relative">
      {/* Global Logo */}
      <div className="absolute top-6 left-6 sm:top-8 sm:left-10 z-50 animate-fade-in">
        <Logo />
      </div>

      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-amber-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[20%] right-[-10%] w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Hero Section */}
      <div className="container relative z-10 max-w-5xl mx-auto px-6 flex flex-col items-center text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-amber-800 dark:text-amber-400 mb-8 animate-fade-in shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          DatDon Booking System
        </span>

        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1] mb-6 animate-rise drop-shadow-sm">
          Giải pháp <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-600 drop-shadow-md">Đặt Đơn Hộ</span> <br/> Tối ưu & Tốc độ
        </h1>

        <p className="max-w-2xl text-lg sm:text-xl text-slate-600 dark:text-slate-300 mb-10 leading-relaxed animate-rise" style={{animationDelay: '100ms'}}>
          Trải nghiệm hệ thống đặt hàng trung gian thông minh. Nạp tiền siêu tốc, tự động phân tích đường dẫn, bảo mật tuyệt đối. Tất cả quy tụ trong một nền tảng chuyên nghiệp.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-20 animate-rise" style={{animationDelay: '200ms'}}>
          <Link
            href="/register"
            className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 px-8 py-4 text-base font-bold text-white shadow-lg shadow-amber-500/25 transition-all hover:scale-105 hover:shadow-xl hover:shadow-amber-500/40"
          >
            Tạo tài khoản ngay
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-2xl border-2 border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-md px-8 py-4 text-base font-bold text-slate-700 dark:text-white transition-all hover:bg-slate-50 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20"
          >
            Đăng nhập
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="container max-w-6xl mx-auto px-6 z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4 drop-shadow-sm">Hoạt động trơn tru 3 bước</h2>
          <p className="text-slate-500 dark:text-slate-300 text-lg">Thiết kế tối giản giúp quy trình mua sắm dễ hơn bao giờ hết.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="relative group rounded-3xl bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-slate-200/50 dark:border-white/10 p-8 hover:shadow-2xl hover:shadow-amber-500/10 transition-all duration-300 hover:-translate-y-2 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 dark:bg-amber-500/10 rounded-bl-full transition-transform group-hover:scale-110" />
            <div className="relative z-10 inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 mb-6 group-hover:scale-110 transition-transform shadow-inner">
              <Wallet className="h-7 w-7" />
            </div>
            <h3 className="relative z-10 text-xl font-bold text-slate-900 dark:text-white mb-3">1. Nạp Số Dư</h3>
            <p className="relative z-10 text-slate-600 dark:text-white/70 leading-relaxed text-sm">
              Nạp tiền dễ dàng qua nhiều phương thức. Số dư hiển thị minh bạch, cập nhật auto trong tích tắc để sẵn sàng lên đơn.
            </p>
          </div>

          {/* Card 2 */}
          <div className="relative group rounded-3xl bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-slate-200/50 dark:border-white/10 p-8 hover:shadow-2xl hover:shadow-amber-500/10 transition-all duration-300 hover:-translate-y-2 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 dark:bg-emerald-500/10 rounded-bl-full transition-transform group-hover:scale-110" />
            <div className="relative z-10 inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mb-6 group-hover:scale-110 transition-transform shadow-inner">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <h3 className="relative z-10 text-xl font-bold text-slate-900 dark:text-white mb-3">2. Đặt Hàng Hộ</h3>
            <p className="relative z-10 text-slate-600 dark:text-white/70 leading-relaxed text-sm">
              Dán link Shopee, nhập thông tin nhận hàng. Chuyên viên của chúng tôi sẽ tiếp nhận trực tiếp và lên đơn chuyên nghiệp.
            </p>
          </div>

          {/* Card 3 */}
          <div className="relative group rounded-3xl bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-slate-200/50 dark:border-white/10 p-8 hover:shadow-2xl hover:shadow-amber-500/10 transition-all duration-300 hover:-translate-y-2 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 dark:bg-indigo-500/10 rounded-bl-full transition-transform group-hover:scale-110" />
            <div className="relative z-10 inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 mb-6 group-hover:scale-110 transition-transform shadow-inner">
              <Truck className="h-7 w-7" />
            </div>
            <h3 className="relative z-10 text-xl font-bold text-slate-900 dark:text-white mb-3">3. Theo Dõi & Nhận Hàng</h3>
            <p className="relative z-10 text-slate-600 dark:text-white/70 leading-relaxed text-sm">
              Mã vận đơn cập nhật liên tục Auto-Sync từ Shopee. Khách hàng theo dõi lộ trình và an tâm chờ nhận siêu phẩm.
            </p>
          </div>
        </div>
      </div>

      {/* Trust Badges */}
      <div className="container max-w-5xl mx-auto px-6 mt-24 z-10 border-t border-slate-200/50 dark:border-white/10 pt-16">
        <div className="flex justify-center flex-wrap gap-10 opacity-90 transition-all duration-500">
           <div className="flex items-center gap-3 text-slate-800 dark:text-white font-bold drop-shadow-sm text-lg">
              <Zap className="h-7 w-7 text-amber-500" /> Tốc Độ Xử Lý Nhanh
           </div>
           <div className="flex items-center gap-3 text-slate-800 dark:text-white font-bold drop-shadow-sm text-lg">
              <ShieldCheck className="h-7 w-7 text-emerald-500" /> Cam Kết Bảo Mật
           </div>
           <div className="flex items-center gap-3 text-slate-800 dark:text-white font-bold drop-shadow-sm text-lg">
              <Clock className="h-7 w-7 text-blue-500" /> Hệ Thống Trực Thực 24/7
           </div>
        </div>
      </div>
    </main>
  );
}
