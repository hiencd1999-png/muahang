import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  username: z.string().trim().min(3),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Thông tin đăng nhập không hợp lệ." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { username: parsed.data.username },
  });

  if (!user) {
    return NextResponse.json({ error: "Sai username hoặc password." }, { status: 401 });
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);

  if (!valid) {
    return NextResponse.json({ error: "Sai username hoặc password." }, { status: 401 });
  }

  const token = await createSessionToken({
    sub: String(user.id),
    username: user.username,
    role: user.role,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  });
}
