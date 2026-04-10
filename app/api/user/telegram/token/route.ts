import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { getBotInfo } from "@/lib/telegram";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  const result = await requireApiUser();
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const user = result.user;

  const { getTelegramConfigs } = await import("@/lib/telegram");
  const config = await getTelegramConfigs();
  if (!config.enabled) {
      return NextResponse.json({ error: "Hệ thống Telegram Bot đang bảo trì." }, { status: 400 });
  }

  // Xóa token cũ nếu có
  await prisma.telegramToken.deleteMany({
    where: { userId: user.id }
  });

  const token = crypto.randomBytes(16).toString("hex");
  // Token sống 10 phút
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.telegramToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt
    }
  });

  const botInfo = await getBotInfo();
  const botUsername = botInfo?.username || "DaNangOrderBot"; // fallback if bot is not working
  
  const link = `https://t.me/${botUsername}?start=${token}`;

  return NextResponse.json({ token, link });
}
