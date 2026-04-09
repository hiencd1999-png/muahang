import { Prisma } from "@prisma/client";

export async function createJournal(
    tx: Prisma.TransactionClient,
    type: string,
    entries: { 
       userId?: number; 
       systemAccountId?: string; 
       debit: number; 
       credit: number; 
       note?: string 
    }[]
) {
    // Basic verification: Total Debits must equal Total Credits
    const totalDebit = entries.reduce((acc, e) => acc + (e.debit || 0), 0);
    const totalCredit = entries.reduce((acc, e) => acc + (e.credit || 0), 0);

    if (totalDebit !== totalCredit) {
        throw new Error(`Kế toán rẽ nhánh: Tổng Nợ (${totalDebit}) khác Tổng Có (${totalCredit}) cho giao dịch loại ${type}`);
    }

    // Insert Journal and Lines
    const journal = await tx.journalEntry.create({
        data: {
            type,
            status: "BALANCED",
            lines: {
                create: entries.map(e => ({
                    userId: e.userId,
                    systemAccountId: e.systemAccountId,
                    debit: e.debit || 0,
                    credit: e.credit || 0,
                    note: e.note
                }))
            }
        }
    });

    return journal;
}
