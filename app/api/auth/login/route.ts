import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  identifier: z.string().trim().min(1).max(100, "Định danh quá dài"),
  password: z.string().min(1).max(100, "Mật khẩu quá dài"),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Thông tin đăng nhập không hợp lệ." }, { status: 400 });
  }

  const identifier = parsed.data.identifier.trim();

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: identifier },
        { email: identifier.toLowerCase() },
        { phone: identifier },
      ],
    },
  });

  if (!user) {
    // Fake hash block để tạo delay giống thật chặn Timing Attack enumeration
    await verifyPassword(parsed.data.password, "$2b$10$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
    return NextResponse.json({ error: "Sai thông tin đăng nhập hoặc mật khẩu." }, { status: 401 });
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);

  if (!valid) {
    return NextResponse.json({ error: "Sai thông tin đăng nhập hoặc mật khẩu." }, { status: 401 });
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
