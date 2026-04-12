"use client";

import { X, BookOpen, Clock } from "lucide-react";
import { useState, useEffect } from "react";

export function AdminGuideModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const hasSeenGuide = localStorage.getItem("hasSeenAdminGuide");
    if (!hasSeenGuide) {
      setIsOpen(true);
      localStorage.setItem("hasSeenAdminGuide", "true");
    }
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-2xl bg-[#00A1A1]/10 px-4 py-2.5 text-sm font-semibold text-[#00A1A1] transition hover:bg-[#00A1A1]/20 border border-[#00A1A1]/20 shadow-sm"
      >
        <BookOpen className="h-4 w-4" />
        <span className="hidden sm:inline">Cẩm nang nhận đơn</span>
        <span className="sm:hidden">Cẩm nang</span>
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-2xl bg-[#00A1A1]/10 px-4 py-2.5 text-sm font-semibold text-[#00A1A1] transition hover:bg-[#00A1A1]/20 border border-[#00A1A1]/20 shadow-sm"
      >
        <BookOpen className="h-4 w-4" />
        <span className="hidden sm:inline">Cẩm nang nhận đơn</span>
        <span className="sm:hidden">Cẩm nang</span>
      </button>

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-[2rem] bg-white p-6 md:p-8 shadow-2xl animate-in zoom-in-95 duration-200">
          <button
            onClick={() => setIsOpen(false)}
            className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00A1A1]/10 text-[#00A1A1]">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Quy trình làm việc cho Admin</h2>
              <p className="text-sm font-medium text-slate-500">Cẩm nang 4 bước xử lý đơn hàng Shopee chuẩn</p>
            </div>
          </div>

          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
            {/* Step 1 */}
            <div className="relative flex items-start gap-4 md:justify-center">
              <div className="hidden md:flex flex-col items-end w-1/2 pt-2 pr-8 text-right">
                <h3 className="font-bold text-slate-900">1. Nhận Đơn (PROCESSING)</h3>
                <p className="text-sm text-slate-500 mt-1">Lấy đơn từ kho Chờ xử lý</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white border-[3px] border-amber-500 shadow-sm z-10">
                <span className="font-bold text-amber-500 text-sm">1</span>
              </div>
              <div className="flex flex-col pb-6 md:w-1/2 md:pt-2 md:pl-8">
                <h3 className="font-bold text-slate-900 md:hidden">1. Nhận Đơn</h3>
                <p className="text-sm text-slate-600 mt-2 bg-amber-50 rounded-2xl p-4 border border-amber-100">
                  Xem đơn có trạng thái <span className="font-semibold text-amber-600">PENDING</span>. Bấm nút <strong className="text-amber-800">"Hành động" &gt; "Nhận đơn"</strong> để đưa đơn về tay mình (Trạng thái nảy sang PROCESSING). <br />
                  <span className="block mt-2 text-rose-500 text-xs flex items-center gap-1"><Clock className="h-3 w-3"/> BẠN CHỈ CÓ 30 PHÚT ĐỂ XỬ LÝ. Nếu quá 30 phút, đơn sẽ bị hủy khỏi hàng chờ của bạn!</span>
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative flex items-start gap-4 md:justify-center">
              <div className="hidden md:flex flex-col items-end w-1/2 pt-2 pr-8 text-right">
                <h3 className="font-bold text-slate-900">2. Lên Đơn Đặc Biệt</h3>
                <p className="text-sm text-slate-500 mt-1">Sử dụng thanh toán COD</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white border-[3px] border-blue-500 shadow-sm z-10">
                <span className="font-bold text-blue-500 text-sm">2</span>
              </div>
              <div className="flex flex-col pb-6 md:w-1/2 md:pt-2 md:pl-8">
                <h3 className="font-bold text-slate-900 md:hidden">2. Lên Đơn Mua Hàng</h3>
                <p className="text-sm text-slate-600 mt-2 bg-blue-50 rounded-2xl p-4 border border-blue-100">
                  Lên Shopee, tra cứu sản phẩm và kiểm tra. <br/>
                  - Dán chính xác <b>Địa chỉ và SĐT</b> của khách hàng. <br/>
                  - <b>Áp dụng Mã Voucher</b> đúng hệt như mã trên phân loại đơn yêu cầu. <br/>
                  - Khâu cực quan trọng: Chọn <strong className="text-blue-700">THANH TOÁN KHI NHẬN HÀNG (COD)</strong> rồi đặt hàng chốt đơn trên Shopee.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative flex items-start gap-4 md:justify-center">
              <div className="hidden md:flex flex-col items-end w-1/2 pt-2 pr-8 text-right">
                <h3 className="font-bold text-slate-900">3. Setup Theo Dõi Tự Động</h3>
                <p className="text-sm text-slate-500 mt-1">Chờ Shopee nhảy mã</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white border-[3px] border-emerald-500 shadow-sm z-10">
                <span className="font-bold text-emerald-500 text-sm">3</span>
              </div>
              <div className="flex flex-col pb-6 md:w-1/2 md:pt-2 md:pl-8">
                <h3 className="font-bold text-slate-900 md:hidden">3. Đồng Bộ Trạng Thái</h3>
                <p className="text-sm text-slate-600 mt-2 bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                  Sau khi Shopee xử lý xong đơn, quay lại web DatDon, chọn lại trạng thái <b>"Đã Lên Đơn" (ORDER PLACED)</b>.<br/><br/>
                  Copy <b>Cookie Shopee <code>(SPC_ST)</code></b> và mã vận đơn nếu có dán vào web để BOT Auto-tracking tự động cào lộ trình.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative flex items-start gap-4 md:justify-center">
              <div className="hidden md:flex flex-col items-end w-1/2 pt-2 pr-8 text-right">
                <h3 className="font-bold text-slate-900">4. Hoàn Tất</h3>
                <p className="text-sm text-slate-500 mt-1">Kinh doanh tự động</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white border-[3px] border-[#00A1A1] shadow-sm z-10">
                <span className="font-bold text-[#00A1A1] text-sm">4</span>
              </div>
              <div className="flex flex-col md:w-1/2 md:pt-2 md:pl-8">
                <h3 className="font-bold text-slate-900 md:hidden">4. Hoàn Tất Ngầm</h3>
                <p className="text-sm text-slate-600 mt-2 bg-[#00A1A1]/10 rounded-2xl p-4 border border-[#00A1A1]/20">
                  Sau khi dán Cookie Auto-tracking, hệ thống sẽ tự động bắt nhịp hành trình Đơn hàng. Khi người nhận thanh toán xong và bưu tá báo Giao thành công, hệ thống DatDon sẽ tự nảy chữ <b>DELIVERED</b> và nổ hoa hồng thẳng vào ví Bạn!
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-2xl bg-slate-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 shadow-xl shadow-slate-900/20"
            >
              Đã hiểu, Bắt đầu làm việc
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
