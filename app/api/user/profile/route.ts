import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export async function GET() {
  const result = await requireApiUser();

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    id: result.user.id,
    username: result.user.username,
    email: result.user.email,
    phone: result.user.phone,
    role: result.user.role,
    balance: result.user.balance,
  });
}

export async function PUT(request: Request) {
  const result = await requireApiUser();

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const body = await request.json();
  const parsed = updatePasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const valid = await verifyPassword(parsed.data.currentPassword, result.user.passwordHash);

  if (!valid) {
    return NextResponse.json({ error: "Mật khẩu hiện tại không đúng." }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);

  await prisma.user.update({
    where: { id: result.user.id },
    data: { passwordHash },
  });

  return NextResponse.json({ success: true });
}
