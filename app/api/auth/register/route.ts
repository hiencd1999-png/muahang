import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, hashPassword, SESSION_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

const fullNameRegex = /^[A-Za-zÀ-ỹ]+\s[A-Za-zÀ-ỹ\s]+$/;
const usernameRegex = /^(?!\d)[a-z0-9_]{4,20}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const phoneRegex = /^(03|05|07|08|09)[0-9]{8}$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

const schema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Không được để trống")
    .max(60, "Tên người dùng tối đa 60 ký tự")
    .refine((value) => value.trim().split(/\s+/).length >= 2, "Phải có ít nhất 2 từ")
    .regex(fullNameRegex, "Chỉ được chứa chữ cái"),
  username: z
    .string()
    .trim()
    .min(1, "Không được để trống")
    .regex(usernameRegex, "4-20 ký tự, chữ thường, số, _, không bắt đầu bằng số"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Không được để trống")
    .regex(emailRegex, "Email không hợp lệ"),
  phone: z
    .string()
    .trim()
    .min(1, "Không được để trống")
    .regex(phoneRegex, "SĐT không hợp lệ"),
  password: z
    .string()
    .min(1, "Không được để trống")
    .max(100, "Mật khẩu quá dài")
    .regex(passwordRegex, "Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt"),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const { allowed } = checkRateLimit(`register_${ip}`, 5, 60 * 60 * 1000); // Tối đa 5 lượt đăng ký / 1 giờ / 1 IP
  if (!allowed) {
    return NextResponse.json({ error: "Thiết bị của bạn đã tạo quá nhiều tài khoản. Vui lòng thử lại sau 1 giờ!" }, { status: 429 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const firstError = Object.values(errors)[0]?.[0];
    return NextResponse.json(
      { error: firstError || "Dữ liệu đăng ký không hợp lệ" },
      { status: 400 }
    );
  }

  // Check for existing username
  const existingUsername = await prisma.user.findUnique({
    where: { username: parsed.data.username },
  });

  if (existingUsername) {
    return NextResponse.json({ error: "Username đã tồn tại" }, { status: 409 });
  }

  // Check for existing email
  const existingEmail = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (existingEmail) {
    return NextResponse.json({ error: "Email đã được đăng ký" }, { status: 409 });
  }

  // Check for existing phone
  const existingPhone = await prisma.user.findUnique({
    where: { phone: parsed.data.phone },
  });

  if (existingPhone) {
    return NextResponse.json({ error: "Số điện thoại đã được đăng ký" }, { status: 409 });
  }

  const passwordHash = await hashPassword(parsed.data.password);

  try {
    const user = await prisma.user.create({
      data: {
        fullName: parsed.data.fullName,
        username: parsed.data.username,
        email: parsed.data.email,
        phone: parsed.data.phone,
        passwordHash,
      },
    });

    // Tự động tạo session để đăng nhập luôn
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
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Đăng ký thất bại, vui lòng thử lại" },
      { status: 500 }
    );
  }
}
