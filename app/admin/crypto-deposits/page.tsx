import { requireUser } from "@/lib/session";
import { CryptoManagementTable } from "./crypto-management-table";

export const metadata = { title: "Duyệt Nạp USDT | SPAdmin" };

export default async function CryptoDepositsPage() {
    await requireUser("SPADMIN"); // Chỉ SPADMIN mới có quyền duyệt

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Kiểm soát Nạp Tiền Crypto (USDT)</h1>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Đối soát bằng tay các giao dịch chuyển USDT bị thiếu hoặc API Blockchain bị kẹt. (Tỷ giá tạm tính: 25,500đ/USDT).
                </p>
            </div>
            
            <CryptoManagementTable />
        </div>
    );
}
