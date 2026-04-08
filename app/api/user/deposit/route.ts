import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { createNotification } from "@/lib/notifications";

const schema = z.object({
  amount: z.number().int().min(1000),
});

export async function POST(request: Request) {
  const result = await requireApiUser();

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Số tiền nạp không hợp lệ." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: result.user.id },
      data: { balance: { increment: parsed.data.amount } },
    });

    await tx.transaction.create({
      data: {
        userId: result.user.id,
        amount: parsed.data.amount,
        type: "DEPOSIT",
        note: "User deposit",
      },
    });
  });

  // Create notification
  await createNotification(
    result.user.id,
    "DEPOSIT_SUCCESS",
    "Nạp tiền thành công",
    `Bạn vừa nạp ${(parsed.data.amount / 1000).toFixed(0)}k vào tài khoản`,
    "/dashboard/deposit"
  );

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/deposit");

  return NextResponse.json({ success: true });
}
