import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";

export async function DELETE(request: NextRequest) {
  const result = await requireApiUser();
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const user = result.user;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      telegramId: null,
      telegramUsername: null
    }
  });

  return NextResponse.json({ success: true });
}
