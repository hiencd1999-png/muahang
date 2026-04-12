import { AlertTriangle, ShieldCheck, HelpCircle, FileText, Gift, Info } from "lucide-react";
import type { UserRole } from "@/lib/roles";

export function PoliciesContent({ role }: { role: UserRole }) {
  const isAdmin = role === "ADMIN" || role === "SPADMIN";

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center py-6">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight dark:text-white">Thoả thuận & Chính sách</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Các quy định áp dụng khi sử dụng nền tảng Dropshipping nội bộ.</p>
      </div>

      {/* CHÍNH SÁCH CHUNG - Áp dụng cho cả User và Admin */}
      <div className="panel rounded-3xl bg-white p-6 md:p-8 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="h-7 w-7 text-emerald-600" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Chính Sách Bảo Hành & Đền Bù</h2>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 text-amber-900 border border-amber-200/60 dark:bg-amber-900/10 dark:text-amber-200 dark:border-amber-900/30">
            <Gift className="h-5 w-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" />
            <div>
              <strong className="block text-sm mb-1 uppercase tracking-wider text-amber-800 dark:text-amber-400">Quy định mã giảm giá</strong>
              <span>Mã Voucher 100K <strong>KHÔNG</strong> áp dụng cho đơn hàng chứa từ 2 link sản phẩm trở lên. Xin vui lòng tách đơn nếu bạn có nhiều link, hoặc admin có quyền từ chối tiếp nhận.</span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 text-rose-900 border border-rose-200/60 dark:bg-rose-900/10 dark:text-rose-200 dark:border-rose-900/30">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-500" />
            <div>
              <strong className="block text-sm mb-1 uppercase tracking-wider text-rose-800 dark:text-rose-400">Từ chối bảo hành (Miễn trừ trách nhiệm)</strong>
              <p className="mb-2">Hệ thống DatDon và Admin phụ trách xin phép <strong>từ chối bảo hành/đền bù</strong> cho mọi rủi ro thuộc về phía vận chuyển & khách nhận, bao gồm:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm text-rose-800/90 dark:text-rose-200/80">
                <li>Shipper/Đơn vị vận chuyển làm thất lạc, mất cắp, trộm hàng.</li>
                <li>Khách hàng đầu cuối từ chối nhận hàng (Boom hàng).</li>
                <li>Shipper không thể liên lạc được với khách hàng dẫn đến hoàn đơn.</li>
              </ul>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-50 text-blue-900 border border-blue-200/60 dark:bg-blue-900/10 dark:text-blue-200 dark:border-blue-900/30">
            <Info className="h-5 w-5 shrink-0 mt-0.5 text-blue-600 dark:text-blue-500" />
            <div>
              <strong className="block text-sm mb-1 uppercase tracking-wider text-blue-800 dark:text-blue-400">Trường hợp Shop gốc hủy đơn</strong>
              <span>Đối với trường hợp phía Người Bán (Shop gốc trên sàn) tự ý hủy đơn, không giao hàng, hoặc hết hàng: Hệ thống hỗ trợ hoàn trả <strong>50% giá trị tiền phí dịch vụ/voucher</strong> của đơn hàng đó về lại Ví của User trên hệ thống. (Lưu ý: Không hoàn trả 100% vì hệ thống/Admin đã tốn công sức làm việc và thao tác mua hộ).</span>
            </div>
          </div>
        </div>
      </div>

      {/* ROLE SPECIFIC GUIDE */}
      {!isAdmin ? (
        <div className="panel rounded-3xl bg-slate-50 p-6 md:p-8 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
           <div className="flex items-center gap-3 mb-6">
            <HelpCircle className="h-7 w-7 text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Cẩm Nang Lên Đơn Cho Khách Hàng (User)</h2>
          </div>
          <ol className="relative border-l border-indigo-200 dark:border-indigo-900 ml-4 space-y-8 pb-4">
            <li className="ml-6">
                <span className="absolute flex items-center justify-center w-8 h-8 bg-indigo-100 rounded-full -left-4 ring-4 ring-white dark:ring-slate-900 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 font-bold text-sm">1</span>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Chuẩn bị nội dung</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Copy địa chỉ Link sản phẩm trên Shopee mà bạn muốn mua. Ghi chú rõ Tên phân loại (Màu sắc, kích thước...) và số lượng cần mua.</p>
            </li>
            <li className="ml-6">
                <span className="absolute flex items-center justify-center w-8 h-8 bg-indigo-100 rounded-full -left-4 ring-4 ring-white dark:ring-slate-900 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 font-bold text-sm">2</span>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Nạp Tiền</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Vào mục <strong>Nạp tiền</strong>, chuyển khoản ngân hàng hoặc ví USDT theo đúng cú pháp hiển thị. Tiền sẽ vào ví khả dụng để bạn dùng trả phí Voucher.</p>
            </li>
            <li className="ml-6">
                <span className="absolute flex items-center justify-center w-8 h-8 bg-indigo-100 rounded-full -left-4 ring-4 ring-white dark:ring-slate-900 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 font-bold text-sm">3</span>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Tạo Đơn Hàng Mới</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Vào mục <strong>Tạo đơn</strong>, dán Link, ghi thông tin địa chỉ/SĐT người nhận thật chính xác. Cuối cùng, <strong>Chọn loại mã Voucher</strong> bạn muốn Admin dùng để đặt mua giúp bạn.</p>
            </li>
            <li className="ml-6">
                <span className="absolute flex items-center justify-center w-8 h-8 bg-indigo-100 rounded-full -left-4 ring-4 ring-white dark:ring-slate-900 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 font-bold text-sm">4</span>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Chờ nhận hàng & Trả COD</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Admin sẽ thay bạn đặt đơn qua Shopee dưới hình thức <strong>Thanh Toán Khi Nhận Hàng (COD)</strong> kèm Mã giảm giá. Bạn chỉ việc đợi Shipper gọi, thanh toán số tiền giá gộp (đã giảm) cho Shipper và nhận hàng.</p>
            </li>
          </ol>
        </div>
      ) : (
        <div className="panel rounded-3xl bg-slate-50 p-6 md:p-8 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
           <div className="flex items-center gap-3 mb-6">
            <FileText className="h-7 w-7 text-emerald-600" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Quy Trình Chuẩn Xử Lý Đơn Dành Cho Admin</h2>
          </div>
          <ol className="relative border-l border-emerald-200 dark:border-emerald-900 ml-4 space-y-8 pb-4">
            <li className="ml-6">
                <span className="absolute flex items-center justify-center w-8 h-8 bg-emerald-100 rounded-full -left-4 ring-4 ring-white dark:ring-slate-900 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 font-bold text-sm">1</span>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Nhận Đơn Trực Tiếp</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Thường xuyên kiểm tra danh sách đơn <strong>PENDING</strong>. Bấm nút <strong>"Nhận Đơn"</strong> để đơn nằm trong quyền quản lý của bạn (Trạng thái chuyển thành PROCESSING).</p>
                <div className="mt-2 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 py-1.5 px-3 rounded-lg inline-block dark:bg-rose-900/20 dark:border-rose-800/30">CẢNH BÁO: BẠN CHỈ CÓ TUYỆT ĐỐI 30 PHÚT ĐỂ LÊN ĐƠN KỂ TỪ LÚC NHẬN!</div>
            </li>
            <li className="ml-6">
                <span className="absolute flex items-center justify-center w-8 h-8 bg-emerald-100 rounded-full -left-4 ring-4 ring-white dark:ring-slate-900 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 font-bold text-sm">2</span>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Lên Đơn COD Trên Shopee</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Sử dụng account Shopee của cá nhân bạn.<br/>
                    - Nhập lại SĐT & Địa chỉ khách hàng hiển thị trên web vào Shopee.<br/>
                    - Lưu ý <strong>Ghi đè hoặc áp dụng chính xác Voucher</strong> mà khách đã order.<br/>
                    - Quan trọng nhất: Bắt buộc chọn phương thức <strong>Thanh toán khi nhận hàng (COD)</strong> rồi chốt đơn đặt hàng trên app.
                </p>
            </li>
            <li className="ml-6">
                <span className="absolute flex items-center justify-center w-8 h-8 bg-emerald-100 rounded-full -left-4 ring-4 ring-white dark:ring-slate-900 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 font-bold text-sm">3</span>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Đồng Bộ Cookie Tracking (SPC_ST)</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Quay lại DatDon, bấm "Cập nhật đơn" $\rightarrow$ Chọn trạng thái <strong>Đã Đặt Đơn</strong>.<br/>
                    Dán phần mã Token Cookie Shopee (<code>SPC_ST</code>) vào web để Robot của DatDon tự động chạy nền theo dõi lộ trình đơn hàng Shopee đó.
                </p>
            </li>
            <li className="ml-6">
                <span className="absolute flex items-center justify-center w-8 h-8 bg-emerald-100 rounded-full -left-4 ring-4 ring-white dark:ring-slate-900 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 font-bold text-sm">4</span>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Nhận Lãi & Rút Tiền</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Khi đơn hàng Shopee vận chuyển thành công tới tay khách và khách trả nguyên tiền mặt (COD). Robot tự bắt sóng cập nhật Trạng thái thành công $\rightarrow$ Hoa hồng % tự động đổ tiền vào tài khoản Ví của bạn. Bạn tiếp tục kéo về Ví USDT/Bank của mình.</p>
            </li>
          </ol>
        </div>
      )}

      {/* THÔNG TIN LIÊN HỆ */}
      <div className="panel rounded-3xl bg-slate-900 p-6 md:p-8 shadow-xl border border-slate-800 text-white dark:bg-slate-950">
        <h2 className="text-xl font-bold text-white mb-4">Liên Hệ Hỗ Trợ Kỹ Thuật</h2>
        <p className="text-slate-400 text-sm mb-6">Mọi thắc mắc về kỹ thuật nền tảng, nạp tiền, rút tiền thưởng, hay khiếu nại thao tác, xin vui lòng trực tiếp liên hệ 24/7 theo phương thức sau:</p>
        
        <div className="grid sm:grid-cols-2 gap-4">
            <a href="https://t.me/your_telegram_bot" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-slate-800 hover:bg-slate-700 transition p-4 rounded-2xl border border-slate-700">
                <svg className="w-6 h-6 text-sky-400" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                <div className="text-left">
                    <strong className="block text-sm">Bot CSKH & Lệnh</strong>
                    <span className="text-xs text-slate-400">Chat ngay</span>
                </div>
            </a>
            
            <a href="mailto:support@datdon.com" className="flex items-center gap-3 bg-slate-800 hover:bg-slate-700 transition p-4 rounded-2xl border border-slate-700">
                <svg className="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                <div className="text-left">
                    <strong className="block text-sm">Email SPADMIN</strong>
                    <span className="text-xs text-slate-400">admin@datdon.com</span>
                </div>
            </a>
        </div>
      </div>
    </div>
  );
}
