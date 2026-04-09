import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";

export async function GET() {
    const result = await requireApiUser("SPADMIN");
    if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
    }

    try {
        // 1. Fetch all users and their transaction sums in a grouped query
        const balances = await prisma.user.findMany({
            select: { id: true, username: true, role: true, balance: true }
        });

        const txSums = await prisma.transaction.groupBy({
            by: ['userId'],
            _sum: {
                amount: true
            }
        });

        // 2. Map sums to a dictionary for fast lookup
        const sumDict: Record<number, number> = {};
        for (const sum of txSums) {
            sumDict[sum.userId] = sum._sum.amount || 0;
        }

        const discrepancies: any[] = [];
        let totalSystemLiability = 0; // Tổng số dư nợ của mạng lưới
        let totalFloatingDiscrepancy = 0; // Tổng chênh lệch thất thoát

        for (const user of balances) {
            const calculatedBalance = sumDict[user.id] || 0;
            totalSystemLiability += user.balance;

            if (calculatedBalance !== user.balance) {
                const drift = user.balance - calculatedBalance;
                totalFloatingDiscrepancy += drift;

                discrepancies.push({
                    userId: user.id,
                    username: user.username,
                    role: user.role,
                    currentMutableBalance: user.balance,
                    calculatedLedgerBalance: calculatedBalance,
                    driftAmount: drift
                });
            }
        }

        return NextResponse.json({
            success: true,
            scannedUsers: balances.length,
            totalSystemLiability,
            totalFloatingDiscrepancy,
            isHealthy: discrepancies.length === 0,
            discrepancies,
            timestamp: new Date().toISOString()
        });

    } catch (e: any) {
        return NextResponse.json({ error: "Reconciliation engine failed: " + e.message }, { status: 500 });
    }
}
