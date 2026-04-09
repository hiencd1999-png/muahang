"use client";

import { useState } from "react";
import { AdminBankSettings } from "../bank-config/bank-settings";
import { BankDepositsTable } from "./bank-deposits-table";
import { Landmark, ListOrdered } from "lucide-react";

export function BankManagementTabs() {
    const [tab, setTab] = useState<"deposits" | "config">("deposits");

    return (
        <div className="space-y-6">
            <div className="flex border-b border-slate-200 dark:border-slate-800">
                <button
                    onClick={() => setTab("deposits")}
                    className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm border-b-2 transition-colors ${tab === "deposits" ? "border-amber-500 text-amber-600 dark:text-amber-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                >
                    <ListOrdered size={16} /> Quản lý giao dịch nạp
                </button>
                <button
                    onClick={() => setTab("config")}
                    className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm border-b-2 transition-colors ${tab === "config" ? "border-amber-500 text-amber-600 dark:text-amber-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                >
                    <Landmark size={16} /> Cấu hình ngân hàng
                </button>
            </div>

            <div className="pt-2">
                {tab === "deposits" ? <BankDepositsTable /> : <AdminBankSettings />}
            </div>
        </div>
    );
}
