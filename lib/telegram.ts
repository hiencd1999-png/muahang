import TelegramBot from 'node-telegram-bot-api';
import { prisma } from '@/lib/prisma';

const globalAny: any = global;

if (!globalAny.telegramBotInstance) {
    globalAny.telegramBotInstance = null;
    globalAny.telegramIsPolling = false;
    globalAny.telegramCurrentToken = '';
}

export async function getTelegramConfigs() {
   const configs = await prisma.systemConfig.findMany({
      where: { key: { startsWith: 'TELEGRAM_' } }
   });
   
   const map = new Map<string, string>();
   for (const c of configs) map.set(c.key, c.value);
   
   return {
      botToken: map.get('TELEGRAM_BOT_TOKEN') || '',
      enabled: map.get('TELEGRAM_BOT_ENABLED') === 'true',
      notifyUserOrder: map.get('TELEGRAM_NOTIFY_USER_ORDER') !== 'false', // Default true
      notifyUserDeposit: map.get('TELEGRAM_NOTIFY_USER_DEPOSIT') !== 'false',
      notifyAdminOrder: map.get('TELEGRAM_NOTIFY_ADMIN_ORDER') !== 'false',
      notifyAdminDeposit: map.get('TELEGRAM_NOTIFY_ADMIN_DEPOSIT') !== 'false',
      notifyAdminWithdrawal: map.get('TELEGRAM_NOTIFY_ADMIN_WITHDRAWAL') !== 'false',
   };
}

export async function initTelegramBot() {
   const config = await getTelegramConfigs();
   
   if (!config.enabled || !config.botToken) {
       if (globalAny.telegramBotInstance && globalAny.telegramIsPolling) {
           await globalAny.telegramBotInstance.stopPolling();
           globalAny.telegramBotInstance = null;
           globalAny.telegramIsPolling = false;
           globalAny.telegramCurrentToken = '';
           console.log("🛑 Telegram Bot Disabled.");
       }
       return;
   }

   if (globalAny.telegramBotInstance && globalAny.telegramCurrentToken !== config.botToken) {
       await globalAny.telegramBotInstance.stopPolling();
       globalAny.telegramBotInstance = null;
       globalAny.telegramIsPolling = false;
   }

   if (globalAny.telegramBotInstance && !globalAny.telegramIsPolling) {
       await globalAny.telegramBotInstance.startPolling();
       globalAny.telegramIsPolling = true;
       console.log("✅ Telegram Bot Re-enabled.");
   } else if (!globalAny.telegramBotInstance) {
       globalAny.telegramBotInstance = new TelegramBot(config.botToken, { polling: true });
       globalAny.telegramIsPolling = true;
       globalAny.telegramCurrentToken = config.botToken;
       console.log("🚀 Telegram Bot Initialized.");

       globalAny.telegramBotInstance.onText(/^\/start(?: (.+))?$/, async (msg: any, match: any) => {
           const chatId = msg.chat.id.toString();
           const tokenStr = match ? match[1] : null;
           
           if (!tokenStr) {
               globalAny.telegramBotInstance?.sendMessage(chatId, "👋 Chào mừng bạn! Để nhận thông báo, hãy liên kết tài khoản từ Profile của bạn trên Website.");
               return;
           }

           try {
               const savedToken = await prisma.telegramToken.findUnique({
                   where: { token: tokenStr },
                   include: { user: true }
               });
               
               if (!savedToken) {
                   globalAny.telegramBotInstance?.sendMessage(chatId, "❌ Mã liên kết không hợp lệ hoặc đã bị sử dụng.");
                   return;
               }

               if (savedToken.expiresAt < new Date()) {
                   globalAny.telegramBotInstance?.sendMessage(chatId, "❌ Mã liên kết đã hết hạn (chỉ có giá trị trong 10 phút). Vui lòng tạo mã mới.");
                   await prisma.telegramToken.delete({ where: { id: savedToken.id } });
                   return;
               }

               // Tháo liên kết cũ nếu có và cập nhật liên kết mới cho user này
               await prisma.user.update({
                   where: { id: savedToken.userId },
                   data: {
                       telegramId: chatId,
                       telegramUsername: msg.from?.username || null
                   }
               });
               
               // Xóa token sau khi dùng thành công
               await prisma.telegramToken.delete({ where: { id: savedToken.id } });

               globalAny.telegramBotInstance?.sendMessage(chatId, `✅ Liên kết thành công!\nTài khoản DatDon: <b>${savedToken.user.username}</b>\nTừ giờ mọi thông báo quan trọng sẽ được gửi trực tiếp tới đây.`, { parse_mode: 'HTML' });
               
           } catch (e) {
               console.error("Telegram link error:", e);
               globalAny.telegramBotInstance?.sendMessage(chatId, "❌ Hệ thống web đang gặp sự cố nhỏ, vui lòng thử lại sau vài phút.");
           }
       });
   }
}

type MsgType = 'USER_ORDER' | 'USER_DEPOSIT' | 'ADMIN_ORDER' | 'ADMIN_DEPOSIT' | 'ADMIN_WITHDRAWAL';

function formatTelegramMessage(text: string) {
    // Escape HTML safety characters
    let safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Convert *bold* to <b>bold</b> pseudo-markdown that we used
    safeText = safeText.replace(/\*(.*?)\*/g, "<b>$1</b>");
    // Convert [text](url) to <a href="url">text</a>
    safeText = safeText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    return safeText;
}

export async function sendTelegramNotification(userId: number, message: string, type: MsgType) {
    if (!globalAny.telegramBotInstance) await initTelegramBot();

    const config = await getTelegramConfigs();
    if (!config.enabled || !globalAny.telegramBotInstance || !globalAny.telegramIsPolling) return;
    
    let shouldSend = false;
    switch(type) {
        case 'USER_ORDER': shouldSend = config.notifyUserOrder; break;
        case 'USER_DEPOSIT': shouldSend = config.notifyUserDeposit; break;
        case 'ADMIN_ORDER': shouldSend = config.notifyAdminOrder; break;
        case 'ADMIN_DEPOSIT': shouldSend = config.notifyAdminDeposit; break;
        case 'ADMIN_WITHDRAWAL': shouldSend = config.notifyAdminWithdrawal; break;
    }
    
    if (!shouldSend) return;

    try {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { telegramId: true } });
        if (user?.telegramId) {
            const formatted = formatTelegramMessage(message);
            await globalAny.telegramBotInstance.sendMessage(user.telegramId, formatted, { parse_mode: 'HTML' }).catch((e: any) => {
                console.error(`Telegram send failed to user ${userId} (${user.telegramId}):`, e.message);
            });
        }
    } catch (e) {
        console.error(`Failed to lookup telegram user ${userId}:`, e);
    }
}

export async function broadcastToAdmins(message: string, type: MsgType) {
    if (!globalAny.telegramBotInstance) await initTelegramBot();

    const config = await getTelegramConfigs();
    if (!config.enabled || !globalAny.telegramBotInstance || !globalAny.telegramIsPolling) return;
    
    let shouldSend = false;
    switch(type) {
        case 'USER_ORDER': 
        case 'USER_DEPOSIT': 
            return;
        case 'ADMIN_ORDER': shouldSend = config.notifyAdminOrder; break;
        case 'ADMIN_DEPOSIT': shouldSend = config.notifyAdminDeposit; break;
        case 'ADMIN_WITHDRAWAL': shouldSend = config.notifyAdminWithdrawal; break;
    }
    
    if (!shouldSend) return;

    try {
        const admins = await prisma.user.findMany({ 
            where: { 
                role: { in: ['ADMIN', 'SPADMIN'] },
                telegramId: { not: null }
            },
            select: { id: true, telegramId: true }
        });

        // Fail-safe không làm chết app chính
        for (const admin of admins) {
            const formatted = formatTelegramMessage(message);
            globalAny.telegramBotInstance.sendMessage(admin.telegramId!, formatted, { parse_mode: 'HTML' }).catch((e: any) => {
                console.error(`Telegram broadcast failed to admin ${admin.id}:`, e.message);
            });
        }
    } catch (e) {
        console.error(`Failed to broadcast to admins:`, e);
    }
}

export async function getBotInfo() {
    if (!globalAny.telegramBotInstance) return null;
    try {
        return await globalAny.telegramBotInstance.getMe();
    } catch {
        return null;
    }
}
