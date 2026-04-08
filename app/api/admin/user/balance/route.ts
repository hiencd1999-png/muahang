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

  const isSpAdmin = result.user.role === "SPADMIN";
  const amountChange = parsed.data.mode === "add" ? parsed.data.amount : -parsed.data.amount;
  
  if (!isSpAdmin) {
    if (parsed.data.mode !== "add") {
      return NextResponse.json({ error: "ADMIN chỉ có thể chuyển cộng thêm tiền, không được trừ." }, { status: 400 });
    }
    if (result.user.balance < amountChange) {
      return NextResponse.json({ error: "Số dư Admin không đủ để chuyển cho người dùng." }, { status: 400 });
    }
  }

  console.log(`[QuickAdjustment] Operator: ${result.user.username} (${result.user.role}), Target: ${targetUser.username}, Change: ${amountChange}`);

  await prisma.$transaction(async (tx) => {
    // 1. Deduct from Admin ONLY if not SPADMIN
    if (!isSpAdmin && amountChange > 0) {
      await tx.user.update({
        where: { id: result.user.id },
        data: { balance: { decrement: amountChange } },
      });

      // Transaction for Admin
      await tx.transaction.create({
        data: {
          userId: result.user.id,
          amount: -amountChange,
          type: "ADMIN_ADJUSTMENT",
          note: `Chuyển tiền cho User ${targetUser.username}: -${amountChange} VND`,
        },
      });
    }

    // 2. Add to User
    await tx.user.update({
      where: { id: targetUser.id },
      data: { balance: { increment: amountChange } },
    });

    // 3. Transaction for User
    await tx.transaction.create({
      data: {
        userId: targetUser.id,
        amount: amountChange,
        type: "ADMIN_ADJUSTMENT",
        note: isSpAdmin
          ? `Điều chỉnh số dư bởi SPADMIN ${result.user.username}: ${amountChange > 0 ? "+" : ""}${amountChange} VND`
          : `Nhận tiền từ Admin ${result.user.username}: +${amountChange} VND`,
      },
    });

    // 4. Audit Log
    await tx.auditLog.create({
      data: {
        adminId: result.user.id,
        action: isSpAdmin ? "SPADMIN_ADJUST_BALANCE" : "ADMIN_TRANSFER_BALANCE",
        targetType: "USER",
        targetId: targetUser.id,
        details: JSON.stringify({
          username: targetUser.username,
          amountTransfer: amountChange,
          adminPreviousBalance: result.user.balance,
          userPreviousBalance: targetUser.balance,
          isSpAdmin,
        }),
      },
    });
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/transactions");
  revalidatePath("/admin/logs");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/deposit");
  revalidatePath("/dashboard/transactions");

  return NextResponse.json({ success: true });
}
