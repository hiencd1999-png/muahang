import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";

export default async function NotificationsPage() {
  const user = await requireUser();

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <section className="panel rounded-[1.75rem] p-4 sm:p-6">
      <h2 className="text-xl font-semibold text-slate-950">Tất cả thông báo</h2>

      <div className="mt-6 space-y-3">
        {notifications.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
            <p className="text-sm text-slate-600">Chưa có thông báo nào</p>
          </div>
        ) : (
          <>
            {/* Desktop View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="pb-3 px-4 font-semibold">Tiêu đề</th>
                    <th className="pb-3 px-4 font-semibold">Nội dung</th>
                    <th className="pb-3 px-4 font-semibold">Loại</th>
                    <th className="pb-3 px-4 font-semibold">Thời gian</th>
                    <th className="pb-3 px-4 font-semibold">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {notifications.map((notif) => (
                    <tr key={notif.id} className={notif.read ? '' : 'bg-blue-50'}>
                      <td className="py-4 px-4 font-medium text-slate-900">{notif.title}</td>
                      <td className="py-4 px-4 text-slate-600 max-w-xs truncate">{notif.message}</td>
                      <td className="py-4 px-4">
                        <span className="inline-block rounded-md bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                          {notif.type}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-slate-600 text-xs">{formatDate(notif.createdAt)}</td>
                      <td className="py-4 px-4">
                        <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${notif.read ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-700'}`}>
                          {notif.read ? 'Đã đọc' : 'Chưa đọc'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="lg:hidden space-y-3">
              {notifications.map((notif) => (
                <div key={notif.id} className={`rounded-lg border p-4 ${notif.read ? 'border-slate-200 bg-white/70' : 'border-blue-200 bg-blue-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{notif.title}</h3>
                        {!notif.read && (
                          <span className="inline-block h-2 w-2 rounded-full bg-blue-600"></span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{notif.message}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="inline-block rounded-md bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                          {notif.type}
                        </span>
                        <span className="text-xs text-slate-500">{formatDate(notif.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
