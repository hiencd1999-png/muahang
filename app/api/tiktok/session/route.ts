import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const sessions = await prisma.tiktokSession.findMany({
    where: { userId: auth.user.id },
    include: {
      orders: {
        orderBy: {
          createdAt: "desc"
        }
      }
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(sessions);
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { sessions } = await request.json();

    if (!Array.isArray(sessions) || sessions.length === 0) {
      return NextResponse.json({ error: "Invalid sessions array" }, { status: 400 });
    }

    let addedCount = 0;
    for (const sessionStr of sessions) {
      const parts = sessionStr.split("|");
      const session = parts[0]?.trim();
      const note = parts[1]?.trim() || null;
      if (!session) continue;

      const existing = await prisma.tiktokSession.findUnique({
        where: { session },
      });

      if (!existing) {
        await prisma.tiktokSession.create({
          data: {
            userId: auth.user.id,
            session,
            note,
            isActive: true,
          },
        });
        addedCount++;
      }
    }

    return NextResponse.json({ success: true, addedCount });
  } catch (error) {
    console.error("Error adding TikTok sessions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = await request.json();
    await prisma.tiktokSession.deleteMany({
      where: {
        id: Number(id),
        userId: auth.user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
