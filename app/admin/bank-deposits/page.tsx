import { requireUser } from "@/lib/session";
import { BankManagementTabs } from "./bank-management-tabs";

export const metadata = { title: "Bank (Nội Bộ) | Admin" };

export default async function BankDepositsPage() {
    await requireUser("ADMIN");

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Hệ thống Nạp Bank Nội Bộ</h1>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Cấu hình ví ngân hàng và xét duyệt các giao dịch chuyển khoản. 
                </p>
            </div>
            
            <BankManagementTabs />
        </div>
    );
}
