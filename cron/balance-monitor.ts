import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';
import { sendTelegramNotification } from '@/lib/telegram';

const prisma = new PrismaClient();
const SNAPSHOT_FILE = path.resolve(process.cwd(), '.balance_snapshot.json');

export async function runBalanceMonitor() {
    try {
        console.log('[BalanceMonitor] Lấy danh sách số dư người dùng...');
        const users = await prisma.user.findMany({ select: { id: true, username: true, balance: true } });

        let prev: Record<string, number> = {};
        try {
            const raw = await fs.readFile(SNAPSHOT_FILE, 'utf-8');
            const parsed = JSON.parse(raw);
            if (parsed && parsed.balances) prev = parsed.balances;
        } catch (e) {
            // file not found or invalid -> treat as empty
            prev = {};
        }

        const now = new Date().toISOString();
        const increases: Array<{ id: number; username: string; oldBalance: number; newBalance: number; delta: number }> = [];

        for (const u of users) {
            const old = prev[u.id] ?? 0;
            const delta = u.balance - old;
            if (delta > 0) {
                increases.push({ id: u.id, username: u.username, oldBalance: old, newBalance: u.balance, delta });
            }
        }

        if (increases.length > 0) {
            console.log(`[BalanceMonitor] Phát hiện ${increases.length} user có số dư tăng.`);

            // Tạo thông báo gộp cho SPADMIN (quản trị viên đặc quyền)
            const preview = increases.slice(0, 20).map(inc => `- ${inc.username} (ID:${inc.id}): +${inc.delta.toLocaleString('vi-VN')}đ -> ${inc.newBalance.toLocaleString('vi-VN')}đ`);
            const moreNote = increases.length > 20 ? `\n... và ${increases.length - 20} user khác` : '';
            let msg = `🔔 *Balance Monitor Alert*\nPhát hiện ${increases.length} user có số dư tăng (tóm tắt):\n\n${preview.join('\n')}${moreNote}\n\nThời gian: ${now}`;

            // Thêm chi tiết giao dịch gần nhất cho từng user (để SPAdmin có thể điều tra nhanh)
            const detailChunks: string[] = [];
            for (const inc of increases.slice(0, 10)) {
                try {
                    const txs = await prisma.transaction.findMany({
                        where: { userId: inc.id },
                        orderBy: { createdAt: 'desc' },
                        take: 5,
                        select: { amount: true, type: true, note: true, createdAt: true }
                    });

                    const txLines = txs.map(t => `${t.type} ${t.amount.toLocaleString('vi-VN')}đ - ${t.note || ''} (${new Date(t.createdAt).toLocaleString()})`);
                    detailChunks.push(`User: ${inc.username} (ID:${inc.id})\nOld: ${inc.oldBalance.toLocaleString('vi-VN')}đ -> New: ${inc.newBalance.toLocaleString('vi-VN')}đ (+${inc.delta.toLocaleString('vi-VN')}đ)\nRecent Tx:\n${txLines.join('\n')}`);
                } catch (err) {
                    detailChunks.push(`User: ${inc.username} (ID:${inc.id}) - Lỗi khi lấy giao dịch: ${String(err)}`);
                }
            }

            if (detailChunks.length > 0) {
                msg += `\n\n--- Chi tiết mẫu (tối đa 10 user) ---\n${detailChunks.join('\n\n')}`;
            }

            try {
                // Gửi riêng cho mọi SPADMIN (role = SPADMIN) có telegramId
                const spAdmins = await prisma.user.findMany({ where: { role: 'SPADMIN', telegramId: { not: null } }, select: { id: true } });
                for (const admin of spAdmins) {
                    await sendTelegramNotification(admin.id, msg, 'ADMIN_DEPOSIT');
                }
            } catch (err) {
                console.error('[BalanceMonitor] Lỗi gửi Telegram cho SPADMINs:', err);
            }
        } else {
            console.log('[BalanceMonitor] Không phát hiện thay đổi số dư dương cho user.');
        }

        // Write snapshot
        const snapshot = { timestamp: now, balances: {} as Record<number, number> } as any;
        for (const u of users) snapshot.balances[u.id] = u.balance;
        await fs.writeFile(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2), { mode: 0o600 });
    } catch (e) {
        console.error('[BalanceMonitor] Lỗi khi chạy monitor:', e);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    runBalanceMonitor().catch(e => {
        console.error('Balance monitor failed:', e);
        process.exit(1);
    });
}
