import { requireUser } from "@/lib/session";
import { isSpAdminRole } from "@/lib/roles";
import { redirect } from "next/navigation";
import { SystemBanksManager } from "./manager";

export const metadata = {
  title: "Quản lý Cổng Bank (System Banks)",
};

export default async function SystemBanksPage() {
  const admin = await requireUser("SPADMIN");

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold dark:text-white">Kiểm soát Cổng thanh toán</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Danh sách toàn bộ các ngân hàng cài đặt bởi các Admins. Bạn có thể Bật/Tắt cổng Bank của bất kỳ Admin nào.</p>
      </div>
      <SystemBanksManager />
    </div>
  );
}
