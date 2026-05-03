import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id, note } = await request.json();

    const session = await prisma.tiktokSession.findFirst({
      where: { id: Number(id), userId: auth.user.id },
    });

    if (!session) {
      return NextResponse.json({ error: "Session không tồn tại" }, { status: 404 });
    }

    await prisma.tiktokSession.update({
      where: { id: Number(id) },
      data: { note: note || null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating TikTok session note:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
