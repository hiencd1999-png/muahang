import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage(props: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireUser("ADMIN");

  const searchParams = await props.searchParams;

  // Xử lý bộ lọc thời gian (Mặc định là tư đầu tháng đến hiện tại)
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const defaultEnd = now.toISOString().split("T")[0];
  
  const startParam = searchParams.from || defaultStart;
  const endParam = searchParams.to || defaultEnd;

  const startDate = new Date(`${startParam}T00:00:00`);
  const endDate = new Date(`${endParam}T23:59:59.999`);

  // 1. Phân tích số lượng đơn & trạng thái
  const ordersInMonth = await prisma.order.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
    },
    select: {
      status: true,
      total: true,
      approvedByAdminId: true,
    },
  });

  const totalOrders = ordersInMonth.length;
  const deliveredOrders = ordersInMonth.filter((o) => o.status === "DELIVERED");
  const canceledOrders = ordersInMonth.filter((o) => o.status === "CANCELED");
  
  let totalRevenue = 0;
  let totalSystemProfit = 0;
  let totalAdminCommission = 0;

  deliveredOrders.forEach(o => {
    totalRevenue += o.total;
    const commission = Math.floor(o.total * 0.95);
    totalAdminCommission += commission;
    totalSystemProfit += (o.total - commission);
  });

  // 2. Doanh thu từng Admin
  // Lấy danh sách admin
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SPADMIN"] } },
    select: { id: true, username: true, fullName: true },
  });

  // Gom nhóm thống kê theo admin
  const adminStats = admins.map((admin) => {
    const adminOrders = ordersInMonth.filter((o) => o.approvedByAdminId === admin.id);
    const successAdminOrders = adminOrders.filter((o) => o.status === "DELIVERED");
    const canceledAdminOrders = adminOrders.filter((o) => o.status === "CANCELED");
    
    let revenue = 0;
    let commission = 0;
    let systemProfit = 0;

    successAdminOrders.forEach(o => {
      revenue += o.total;
      const comm = Math.floor(o.total * 0.95);
      commission += comm;
      systemProfit += (o.total - comm);
    });

    return {
      admin,
      totalHandled: adminOrders.length,
      successCount: successAdminOrders.length,
      canceledCount: canceledAdminOrders.length,
      revenue,
      commission,
      systemProfit
    };
  }).sort((a, b) => b.revenue - a.revenue); // Xếp theo doanh thu giảm dần

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Báo cáo & Thống kê</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Phân tích số liệu kinh doanh và năng suất của đội ngũ quản trị.
          </p>
        </div>
        
        {/* Bộ lọc ngày và Nút Xuất Excel */}
        <div className="flex items-center gap-2">
          <form className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
            <label htmlFor="from" className="text-sm font-medium text-slate-600 dark:text-slate-300 ml-2">Từ ngày:</label>
            <input 
              type="date" 
              id="from"
              name="from"
              defaultValue={startParam}
              className="bg-transparent text-sm font-semibold outline-none text-slate-800 dark:text-white dark:[color-scheme:dark]"
            />
            
            <label htmlFor="to" className="text-sm font-medium text-slate-600 dark:text-slate-300 ml-2">Đến ngày:</label>
            <input 
              type="date" 
              id="to"
              name="to"
              defaultValue={endParam}
              className="bg-transparent text-sm font-semibold outline-none text-slate-800 dark:text-white dark:[color-scheme:dark]"
            />

            <button type="submit" className="px-3 py-1.5 ml-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition">
              Lọc
            </button>
          </form>

          <a 
            href={`/api/admin/analytics/export?from=${startParam}&to=${endParam}`}
            download
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition flex items-center justify-center shadow-sm"
          >
            Xuất Excel
          </a>
        </div>
      </div>

      {/* Tóm tắt chỉ số */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="panel p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
          <p className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Tổng số đơn</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{totalOrders}</span>
            <span className="text-xs font-semibold text-slate-400">đơn</span>
          </div>
        </div>

        <div className="panel p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
          <p className="text-xs uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-500">Thành công</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-700 dark:text-emerald-400">{deliveredOrders.length}</span>
            <span className="text-xs font-semibold text-emerald-600/70 dark:text-emerald-500/70">đơn</span>
          </div>
        </div>

        <div className="panel p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
          <p className="text-xs uppercase tracking-wider font-bold text-rose-600 dark:text-rose-500">Bị huỷ</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-700 dark:text-rose-400">{canceledOrders.length}</span>
            <span className="text-xs font-semibold text-rose-600/70 dark:text-rose-500/70">đơn</span>
          </div>
        </div>

        <div className="panel p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/40 dark:to-orange-900/10 border border-amber-200 dark:border-amber-800/60">
          <p className="text-xs uppercase tracking-wider font-bold text-amber-700 dark:text-amber-500">Doanh thu giao thành công</p>
          <div className="mt-2 flex items-baseline">
            <span className="text-xl sm:text-2xl font-black text-amber-900 dark:text-amber-100">{formatCurrency(totalRevenue)}</span>
          </div>
        </div>

        <div className="panel p-5 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/40 dark:to-blue-900/10 border border-indigo-200 dark:border-indigo-800/60 mt-4 sm:mt-0 col-span-2 md:col-span-4 lg:col-span-1">
          <p className="text-xs uppercase tracking-wider font-bold text-indigo-700 dark:text-indigo-500">Lợi nhuận SPAdmin (5%)</p>
          <div className="mt-2 flex items-baseline">
            <span className="text-xl sm:text-2xl font-black text-indigo-900 dark:text-indigo-100">{formatCurrency(totalSystemProfit)}</span>
          </div>
        </div>
      </div>

      {/* Bảng phân tích Admin */}
      <div className="panel rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">Báo cáo doanh thu theo Admin</h3>
        </div>
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-950/50 text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Nhân sự (Admin)</th>
                <th className="px-6 py-4 text-center">Đã nhận xử lý</th>
                <th className="px-6 py-4 text-center">Hoàn thành</th>
                <th className="px-6 py-4 text-center">Bị huỷ</th>
                <th className="px-6 py-4 text-right">Tổng doanh thu đem về</th>
                <th className="px-6 py-4 text-right">Hoa hồng tạm tính (95%)</th>
                <th className="px-6 py-4 text-right">Sinh lời SPAdmin (5%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {adminStats.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">Không có dữ liệu trong khoảng thời gian này.</td>
                </tr>
              )}
              {adminStats.map((stat) => (
                <tr key={stat.admin.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900 dark:text-slate-100">{stat.admin.fullName || stat.admin.username}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 break-all">@{stat.admin.username}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="font-bold text-slate-700 dark:text-slate-300">{stat.totalHandled}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold">
                      {stat.successCount}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 font-bold">
                      {stat.canceledCount}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-black text-slate-800 dark:text-slate-200">
                    {formatCurrency(stat.revenue)}
                  </td>
                  <td className="px-6 py-4 text-right font-black text-amber-600 dark:text-amber-500">
                    {formatCurrency(stat.commission)}
                  </td>
                  <td className="px-6 py-4 text-right font-black text-indigo-600 dark:text-indigo-500">
                    {formatCurrency(stat.systemProfit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
