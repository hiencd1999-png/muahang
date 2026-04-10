"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";

type AdminReq = {
  id: number;
  user: { username: string; fullName: string | null; role: string };
  status: string;
  createdAt: Date;
};

export function AdminRequestsView({ requests }: { requests: AdminReq[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<number | null>(null);

  const handleManage = async (id: number, action: "APPROVE" | "REJECT") => {
    if (action === "APPROVE" && !confirm("Bạn có chắc chắn thu nạp User này làm Admin hệ thống? (Thay đổi role sang ADMIN)")) return;
    try {
      setLoading(id);
      const res = await fetch("/api/admin/admin-requests/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert(`Đã ${action === "APPROVE" ? "chấp thuận" : "từ chối"} yêu cầu.`);
      router.refresh();
    } catch (e: any) {
      alert(e.message || "Lỗi hệ thống");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="panel rounded-[1.75rem] p-6 lg:p-8">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Yêu Cầu Làm Admin</h2>
        <p className="mb-6 text-sm text-slate-600 dark:text-zinc-400">Danh sách các User gửi yêu cầu chuyển đổi lên Admin (đã đủ điều kiện nạp &gt;= 30 USDT).</p>

        {requests.length === 0 ? (
          <p className="text-slate-500 py-10 text-center">Chưa có yêu cầu nào.</p>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="min-w-full text-left text-sm border-collapse">
              <thead className="bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-white border-b-2 dark:border-zinc-700">
                <tr>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Mã YC</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">User Name</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Full Name</th>
                  <th className="px-4 py-3 font-bold uppercase text-center tracking-wider text-xs">Trạng thái</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Ngày gửi</th>
                  <th className="px-4 py-3 font-bold uppercase text-center tracking-wider text-xs">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(req => (
                  <tr key={req.id} className="border-t border-slate-200 dark:border-zinc-800/70 hover:bg-slate-50 dark:hover:bg-zinc-800/80 transition">
                    <td className="px-4 py-4 font-mono">#{req.id}</td>
                    <td className="px-4 py-4 font-semibold text-slate-900 dark:text-white">@{req.user.username}</td>
                    <td className="px-4 py-4">{req.user.fullName || "-"}</td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${
                         req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                         req.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                         'bg-amber-100 text-amber-700'
                      }`}>
                         {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-500 text-xs">
                      {formatDate(req.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      {req.status === "PENDING" ? (
                         <div className="flex justify-center gap-2">
                             <button
                               onClick={() => handleManage(req.id, "APPROVE")}
                               disabled={loading === req.id}
                               className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition"
                             >
                               DUYỆT
                             </button>
                             <button
                               onClick={() => handleManage(req.id, "REJECT")}
                               disabled={loading === req.id}
                               className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition"
                             >
                               TỪ CHỐI
                             </button>
                         </div>
                      ) : (
                         <p className="text-center text-xs text-slate-400 italic">Đã xử lý</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
