import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const result = await requireApiUser();

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const limit = 10;
  const unreadOnly = request.nextUrl.searchParams.get("unread") === "true";

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: {
        userId: result.user.id,
        ...(unreadOnly && { read: false }),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({
      where: {
        userId: result.user.id,
        read: false,
      },
    }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

export async function POST(request: NextRequest) {
  const result = await requireApiUser();

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { notificationId, markAll } = await request.json();

  if (markAll) {
    await prisma.notification.updateMany({
      where: { userId: result.user.id, read: false },
      data: { read: true },
    });
    return NextResponse.json({ success: true });
  }

  if (!notificationId) {
    return NextResponse.json({ error: "notificationId required" }, { status: 400 });
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });

  return NextResponse.json({ success: true });
}
