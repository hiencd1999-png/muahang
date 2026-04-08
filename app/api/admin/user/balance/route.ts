import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";

const schema = z.object({
  userId: z.number().int().positive(),
  amount: z.number().int().min(1000),
  mode: z.enum(["add", "subtract"]),
});

export async function PUT(request: Request) {
  const result = await requireApiUser("ADMIN");

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload điều chỉnh số dư không hợp lệ." }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User không tồn tại." }, { status: 404 });
  }

  const signedAmount = parsed.data.mode === "add" ? parsed.data.amount : -parsed.data.amount;
  const nextBalance = targetUser.balance + signedAmount;

  if (nextBalance < 0) {
    return NextResponse.json({ error: "Không thể trừ vượt quá số dư hiện tại." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: targetUser.id },
      data: { balance: { increment: signedAmount } },
    }),
    prisma.transaction.create({
      data: {
        userId: targetUser.id,
        amount: signedAmount,
        type: "ADMIN_ADJUSTMENT",
        note: `Điều chỉnh số dư bởi ${result.user.username}: ${signedAmount > 0 ? "+" : ""}${signedAmount} VND`,
      },
    }),
    prisma.auditLog.create({
      data: {
        adminId: result.user.id,
        action: "ADMIN_ADJUST_USER_BALANCE",
        targetType: "USER",
        targetId: targetUser.id,
        details: JSON.stringify({
          username: targetUser.username,
          mode: parsed.data.mode,
          amountChange: signedAmount,
          previousBalance: targetUser.balance,
          nextBalance,
        }),
      },
    }),
  ]);

  revalidatePath("/admin/users");
  revalidatePath("/admin/transactions");
  revalidatePath("/admin/logs");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/deposit");
  revalidatePath("/dashboard/transactions");

  return NextResponse.json({ success: true });
}
