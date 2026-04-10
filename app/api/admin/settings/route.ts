import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { getTelegramConfigs, initTelegramBot } from "@/lib/telegram";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const result = await requireApiUser("SPADMIN");
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const configs = await getTelegramConfigs();
  const rawSystemConfigs = await prisma.systemConfig.findMany({
    where: { key: { in: ["CRYPTO_WALLET_BSC", "CRYPTO_WALLET_TRX", "USDT_RATE", "BINANCE_PROXY"] } }
  });
  
  const sysConfigMap = rawSystemConfigs.reduce((acc, curr) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {} as Record<string, string>);

  return NextResponse.json({
    ...configs,
    cryptoWalletBsc: sysConfigMap["CRYPTO_WALLET_BSC"] || "",
    cryptoWalletTrx: sysConfigMap["CRYPTO_WALLET_TRX"] || "",
    usdtRate: sysConfigMap["USDT_RATE"] || "25500",
    binanceProxy: sysConfigMap["BINANCE_PROXY"] || "",
  });
}

export async function POST(request: NextRequest) {
  const result = await requireApiUser("SPADMIN");
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const body = await request.json();

  const mapToUpdate = {
    "TELEGRAM_BOT_TOKEN": body.botToken || "",
    "TELEGRAM_BOT_ENABLED": body.enabled ? "true" : "false",
    "TELEGRAM_NOTIFY_USER_ORDER": body.notifyUserOrder ? "true" : "false",
    "TELEGRAM_NOTIFY_USER_DEPOSIT": body.notifyUserDeposit ? "true" : "false",
    "TELEGRAM_NOTIFY_ADMIN_ORDER": body.notifyAdminOrder ? "true" : "false",
    "TELEGRAM_NOTIFY_ADMIN_DEPOSIT": body.notifyAdminDeposit ? "true" : "false",
    "TELEGRAM_NOTIFY_ADMIN_WITHDRAWAL": body.notifyAdminWithdrawal ? "true" : "false",
    "CRYPTO_WALLET_BSC": body.cryptoWalletBsc || "",
    "CRYPTO_WALLET_TRX": body.cryptoWalletTrx || "",
    "USDT_RATE": body.usdtRate || "25500",
    "BINANCE_PROXY": body.binanceProxy || "",
  };

  const currentConfigs = await getTelegramConfigs();

  for (const [key, value] of Object.entries(mapToUpdate)) {
    await prisma.systemConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  // After updating configs, reload the bot if token or enabled status changed
  if (currentConfigs.botToken !== body.botToken) {
    if (currentConfigs.botToken) {
        // Token changed, we need to sever all connections because the old bot is replaced.
        const linkedUsers = await prisma.user.findMany({
            where: { telegramId: { not: null } },
            select: { id: true }
        });

        if (linkedUsers.length > 0) {
            await prisma.user.updateMany({
                where: { id: { in: linkedUsers.map(u => u.id) } },
                data: { telegramId: null, telegramUsername: null }
            });

            // Optional: send an internal notification
            const notifications = linkedUsers.map(u => ({
                userId: u.id,
                type: "ADMIN_MESSAGE" as const,
                title: "Cập nhật Bot Telegram",
                message: "Hệ thống vừa chuyển sang dùng Bot Telegram mới. Vui lòng vào Thông tin tài khoản để liên kết lại phần Cấu hình Telegram.",
                link: "/dashboard/profile"
            }));
            await prisma.notification.createMany({ data: notifications });
        }
    }
    
    console.log("Admin updated Telegram configs. Reloading Telegram bot from Server...");
    initTelegramBot().catch(e => console.error(e));
  } else if (currentConfigs.enabled !== body.enabled) {
    console.log("Admin updated Telegram toggles. Reloading Telegram bot from Server...");
    initTelegramBot().catch(e => console.error(e));
  }

  return NextResponse.json({ success: true });
}
