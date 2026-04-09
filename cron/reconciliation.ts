import { PrismaClient } from "@prisma/client";
import * as fs from "fs";

// Enterprise Standard: Auto-Reconciliation worker
// Chạy background (VD: 2:00 AM hàng ngày qua systemd, crontab, hoặc PM2)

const prisma = new PrismaClient();
const REPORT_FILE = "reconciliation_reports.log";

async function runReconciliation() {
    console.log(`[Reconciliation Worker] Starting Ledger verification at ${new Date().toISOString()}`);

    try {
        const balances = await prisma.user.findMany({
            select: { id: true, username: true, role: true, balance: true }
        });

        // Use precise transactional aggregation thanks to new Indexes (userId, createdAt)
        const txSums = await prisma.transaction.groupBy({
            by: ['userId'],
            _sum: {
                amount: true
            }
        });

        const sumDict: Record<number, number> = {};
        for (const sum of txSums) {
            sumDict[sum.userId] = sum._sum.amount || 0;
        }

        const discrepancies: any[] = [];
        let totalSystemLiability = 0;
        let totalFloatingDiscrepancy = 0;

        for (const user of balances) {
            const calculatedBalance = sumDict[user.id] || 0;
            totalSystemLiability += user.balance;

            if (calculatedBalance !== user.balance) {
                const drift = user.balance - calculatedBalance;
                totalFloatingDiscrepancy += drift;

                discrepancies.push({
                    userId: user.id,
                    username: user.username,
                    currentMutableBalance: user.balance,
                    calculatedLedgerBalance: calculatedBalance,
                    driftAmount: drift
                });
            }
        }

        const report = {
            timestamp: new Date().toISOString(),
            status: discrepancies.length === 0 ? "HEALTHY" : "DRIFT_DETECTED",
            scannedUsers: balances.length,
            totalSystemLiability,
            totalFloatingDiscrepancy,
            discrepancies: discrepancies.slice(0, 100), // Log max 100
        };

        // Ghi Log bất biến (Append-Only)
        fs.appendFileSync(REPORT_FILE, JSON.stringify(report) + "\n");
        console.log(`[Reconciliation Worker] Completed. Status: ${report.status}. Drift: ${totalFloatingDiscrepancy} VND`);

        // TODO: Nếu drift > 0 -> Bắn còi báo động qua Telegram/Slack Bot cho CTO!

    } catch (e: any) {
        console.error("[Reconciliation Worker] Failed executing verification:", e);
    } finally {
        await prisma.$disconnect();
    }
}

// Logic cho phép chạy thủ công hoặc mount vào Node-Cron
if (require.main === module) {
    runReconciliation();
} else {
    // module.exports = runReconciliation
}
