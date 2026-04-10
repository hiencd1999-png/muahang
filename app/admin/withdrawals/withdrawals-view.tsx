"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/format";

type Withdrawal = {
  id: number;
  userId: number;
  user: { username: string; fullName: string | null; balance: number };
  amount: number;
  walletAddress: string;
  network: string;
  status: string;
  rejectReason: string | null;
  createdAt: Date;
};

export function WithdrawalsView({
  withdrawals,
  isSpAdmin,
  currentBalance,
  pendingAmount,
}: {
  withdrawals: Withdrawal[];
  isSpAdmin: boolean;
  currentBalance: number;
  pendingAmount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Form states for Admin
  const [amountInput, setAmountInput] = useState("");
  const [walletInput, setWalletInput] = useState("");

  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleRequestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const val = parseInt(amountInput.replace(/\D/g, ""), 10);
    if (!val || val < 10000) {
      alert("Số tiền tối thiểu là 10.000 VNĐ.");
      return;
    }

    if (val + pendingAmount > currentBalance) {
      alert(`Vượt quá khả dụng! Đang có: ${formatCurrency(currentBalance)}, Chờ duyệt: ${formatCurrency(pendingAmount)}`);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/admin/withdrawal/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: val, walletAddress: walletInput, network: "BSC/BEP20" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gặp lỗi nội bộ.");
      
      alert("Đã tạo lệnh yêu cầu rút tiền thành công.");
      setAmountInput("");
      setWalletInput("");
      router.refresh();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManage = async (id: number, action: "APPROVE" | "REJECT") => {
    if (action === "REJECT") {
      const reason = prompt("Nhập lý do từ chối (Ví dụ: Sai địa chỉ ví):");
      if (reason === null) return;
      await submitDecision(id, action, reason);
    } else {
      if (!confirm("BẠN CHẮC CHẮN DUYỆT LỆNH NÀY CHỨ? Lệnh sẽ thực hiện chuyển và trừ tiền của Admin này ngay lập tức.")) return;
      await submitDecision(id, action);
    }
  };

  const submitDecision = async (id: number, action: "APPROVE" | "REJECT", rejectReason?: string) => {
    try {
      setActionId(id);
      const res = await fetch("/api/admin/withdrawal/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, rejectReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert(`Đã ${action === "APPROVE" ? "Dán/Phê Duyệt" : "Từ Chối"} lệnh rút số #${id}`);
      router.refresh();
    } catch (error: any) {
      alert(error.message || "Lỗi hệ thống.");
    } finally {
      setActionId(null);
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm("BẠN CÓ CHẮC MUỐN TỰ HỦY LỆNH RÚT NÀY KHÔNG? Lệnh sẽ bị đóng ngay lập tức.")) return;
    try {
      setActionId(id);
      const res = await fetch("/api/admin/withdrawal/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert(`Đã huỷ lệnh kích hoạt số #${id} thành công.`);
      router.refresh();
    } catch (error: any) {
      alert(error.message || "Lỗi hệ thống.");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Withdrawal Form (Only available to ADMIN or SPADMIN acting as ADMIN) */}
      {!isSpAdmin && (
        <section className="panel rounded-[1.75rem] p-6 lg:p-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Yêu Cầu Rút Tiền (USDT)</h2>
          
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/10">
             <h3 className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-2">Quy định rút tiền dành cho Admin:</h3>
             <ul className="list-disc list-inside text-sm text-amber-700 dark:text-amber-500/90 space-y-1">
                 <li>Chỉ được phép tạo tối đa <strong>1 lệnh rút tiền mỗi tuần</strong> (nếu lệnh bị từ chối hoặc hủy thì không bị tính).</li>
                 <li>Phải có <strong>trên 10 đơn hàng</strong> đã trực tiếp xử lý (trạng thái thành công/đã đặt) để đạt điều kiện rút.</li>
                 <li>Mọi giao dịch chỉ được thanh toán qua ví <strong>USDT (chuẩn BEP20/BSC)</strong>.</li>
             </ul>
          </div>
          
          <div className="mb-6 grid gap-4 grid-cols-1 md:grid-cols-2">
             <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 p-4">
                 <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">Số dư khả dụng</p>
                 <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatCurrency(currentBalance)}</p>
             </div>
             <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 p-4">
                 <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">Tiền đang chờ duyệt</p>
                 <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{formatCurrency(pendingAmount)}</p>
             </div>
          </div>

          <form onSubmit={handleRequestWithdrawal} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-2">Số tiền muốn rút (VNĐ)</label>
              <input
                type="text"
                required
                value={amountInput}
                onChange={(e) => {
                  const num = parseInt(e.target.value.replace(/\D/g, ""), 10);
                  setAmountInput(isNaN(num) ? "" : formatCurrency(num));
                }}
                placeholder="VD: 500.000 đ"
                className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 outline-none focus:border-amber-500 font-bold dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-2">Địa chỉ ví USDT (Mạng BSC/BEP20)</label>
              <input
                type="text"
                required
                value={walletInput}
                onChange={(e) => setWalletInput(e.target.value)}
                placeholder="VD: 0x1234567890abcdef..."
                className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 outline-none focus:border-amber-500 font-mono text-sm dark:text-white"
              />
              <p className="text-xs text-rose-500 mt-2 font-bold italic">*Xin lưu ý: Chỉ hỗ trợ rút về ví điện tử USDT (Chuẩn BEP20/BSC). Nếu nhập sai mạng chúng tôi sẽ không chịu trách nhiệm.</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full sm:w-auto rounded-xl bg-amber-600 px-8 py-3 text-sm font-bold text-white hover:bg-amber-700 transition disabled:opacity-50"
            >
              {loading ? "Đang gửi..." : "Gửi lệnh Rút tiền"}
            </button>
          </form>
        </section>
      )}

      {/* Withdrawals List Table */}
      <section className="panel rounded-[1.75rem] p-6 lg:p-8">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Lịch Sử / Yêu Cầu Rút Tiền</h2>
        
        {withdrawals.length === 0 ? (
          <p className="text-slate-500 dark:text-zinc-400 py-10 text-center font-medium">Chưa có giao dịch rút tiền nào.</p>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="min-w-[1000px] w-full text-left text-sm border-collapse">
              <thead className="bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-white shadow-sm border-b-2 dark:border-zinc-700">
                <tr>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Mã Giao Dịch</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Admin</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Số tiền</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Chi tiết Ví</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center">Trạng thái</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Ngày Tạo</th>
                  <th className="px-4 py-3 font-bold text-center uppercase tracking-wider text-xs">Xử lý</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200 dark:border-zinc-800/70 hover:bg-slate-50 dark:hover:bg-zinc-800/80 transition">
                    <td className="px-4 py-4 font-mono font-medium text-slate-900 dark:text-white">#{item.id}</td>
                    <td className="px-4 py-4 text-slate-700 dark:text-zinc-300">
                      <p className="font-semibold text-slate-900 dark:text-white whitespace-nowrap">{item.user.fullName || item.user.username}</p>
                      <p className="text-xs text-slate-400 whitespace-nowrap">@{item.user.username}</p>
                    </td>
                    <td className="px-4 py-4 font-bold text-slate-900 dark:text-white">{formatCurrency(item.amount)}</td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <div 
                           onClick={() => handleCopy(item.id, item.walletAddress)}
                           className="cursor-pointer group flex items-center gap-2"
                           title="Nhấp để copy"
                        >
                           <p className="font-mono text-xs whitespace-nowrap font-semibold text-slate-700 dark:text-zinc-300 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
                             {copiedId === item.id ? "✅ Đã sao chép ví!" : item.walletAddress}
                           </p>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-zinc-800 rounded px-1 w-fit">{item.network}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase ${
                        item.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' :
                        item.status === 'REJECTED' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800' :
                        item.status === 'CANCELED' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 border border-slate-200 dark:border-slate-800' :
                        'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                      }`}>
                        {item.status}
                      </span>
                      {item.rejectReason && <p className="text-xs text-rose-500 mt-1 truncate max-w-[120px]" title={item.rejectReason}>{item.rejectReason}</p>}
                    </td>
                    <td className="px-4 py-4 text-slate-500 dark:text-zinc-400 font-medium text-xs">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      {item.status === "PENDING" ? (
                        <div className="flex justify-center gap-2">
                           {isSpAdmin ? (
                             <>
                               <button
                                 onClick={() => handleManage(item.id, "APPROVE")}
                                 disabled={actionId === item.id}
                                 className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition"
                               >
                                 DUYỆT
                               </button>
                               <button
                                 onClick={() => handleManage(item.id, "REJECT")}
                                 disabled={actionId === item.id}
                                 className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition"
                               >
                                 TỪ CHỐI
                               </button>
                             </>
                           ) : (
                               <button
                                 onClick={() => handleCancel(item.id)}
                                 disabled={actionId === item.id}
                                 className="px-3 py-1.5 rounded-lg border-2 border-rose-500/50 text-rose-600 dark:text-rose-400 dark:hover:text-white hover:bg-rose-500 hover:border-rose-500 hover:text-white text-xs font-bold transition disabled:opacity-50"
                               >
                                 HỦY LỆNH
                               </button>
                           )}
                        </div>
                      ) : (
                        <p className="text-center text-xs text-slate-500 dark:text-zinc-500 italic">Đã chốt</p>
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
