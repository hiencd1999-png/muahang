import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Vietnamese phone number: 10 digits starting with 0, or +84
const phoneRegex = /^(0|\+84)[0-9]{8,10}$/;

const schema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username phải có ít nhất 3 ký tự")
    .max(30, "Username tối đa 30 ký tự")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username chỉ được chứa chữ, số, dấu chấm, gạch ngang và gạch dưới"),
  email: z
    .string()
    .trim()
    .email("Email không hợp lệ"),
  phone: z
    .string()
    .trim()
    .regex(phoneRegex, "Số điện thoại không hợp lệ (ví dụ: 0912345678 hoặc +84912345678)"),
  password: z
    .string()
    .min(6, "Mật khẩu phải có ít nhất 6 ký tự")
    .regex(/[A-Z]/, "Mật khẩu phải có ít nhất 1 chữ cái viết hoa")
    .regex(/[0-9]/, "Mật khẩu phải có ít nhất 1 chữ số"),
});

export async function POST(request: Request) {
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
    await prisma.user.create({
      data: {
        username: parsed.data.username,
        email: parsed.data.email,
        phone: parsed.data.phone,
        passwordHash,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Đăng ký thất bại, vui lòng thử lại" },
      { status: 500 }
    );
  }
}
