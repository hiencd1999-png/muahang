import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { z } from "zod";

const bankConfigSchema = z.object({
  bankName: z.string().min(2),
  accountNumber: z.string().min(5),
  accountName: z.string().min(2),
  branch: z.string().optional().nullable(),
  contactInfo: z.string().min(3, "Vui lòng nhập phương thức liên hệ"),
  isActive: z.boolean()
});

export async function GET(req: Request) {
  const result = await requireApiUser();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  if (result.user.role === "USER") {
      return NextResponse.json({ error: "Không đủ quyền" }, { status: 403 });
  }

  const config = await prisma.adminBankConfig.findUnique({
      where: { adminId: result.user.id }
  });

  return NextResponse.json({ config });
}

export async function POST(req: Request) {
  const result = await requireApiUser();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  if (result.user.role === "USER") {
      return NextResponse.json({ error: "Không đủ quyền" }, { status: 403 });
  }

  try {
      const body = await req.json();
      const data = bankConfigSchema.parse(body);

      const config = await prisma.adminBankConfig.upsert({
          where: { adminId: result.user.id },
          update: data,
          create: {
              adminId: result.user.id,
              ...data
          }
      });

      return NextResponse.json({ success: true, config });
  } catch (error: any) {
      console.error("[BankConfig ERROR]:", error);
      if (error instanceof z.ZodError) {
          return NextResponse.json({ error: "Dữ liệu không hợp lệ: " + JSON.stringify(error.issues) }, { status: 400 });
      }
      return NextResponse.json({ error: "Đã có lỗi xảy ra: " + error.message }, { status: 500 });
  }
}
