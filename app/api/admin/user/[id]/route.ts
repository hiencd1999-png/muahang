import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { USER_ROLES, isSpAdminRole, type UserRole } from "@/lib/roles";
import { requireApiUser } from "@/lib/session";
import { getLockedAdminCommission } from "@/lib/admin-balance";

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

const schema = z
  .object({
    password: z.string().optional(),
    role: z.enum(USER_ROLES).optional(),
    balance: z.number().int().min(0).optional(),
    isLocked: z.boolean().optional(),
  })
  .refine((data) => Boolean(data.password?.trim()) || typeof data.role !== "undefined" || typeof data.balance !== "undefined" || typeof data.isLocked !== "undefined", {
    message: "Cần ít nhất một thay đổi hợp lệ.",
  });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireApiUser("ADMIN");

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { id } = await params;
  const userId = Number.parseInt(id, 10);

  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "User ID không hợp lệ." }, { status: 400 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      role: true,
      balance: true,
      isLocked: true,
    },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User không tồn tại." }, { status: 404 });
  }

  if (isSpAdminRole(result.user.role) && isSpAdminRole(targetUser.role) && result.user.id !== targetUser.id) {
    return NextResponse.json(
      { error: "SPADMIN không thể tác động lên SPADMIN khác." },
      { status: 403 }
    );
  }

  if (!isSpAdminRole(result.user.role) && targetUser.role !== "USER") {
    return NextResponse.json(
      { error: "ADMIN chỉ được chỉnh sửa thông tin của tài khoản role USER." },
      { status: 403 }
    );
  }

  const updates: { passwordHash?: string; role?: UserRole; balance?: number; isLocked?: boolean } = {};
  const changedFields: string[] = [];
  const details: Record<string, unknown> = {
    username: targetUser.username,
  };

  const nextPassword = parsed.data.password?.trim();
  if (nextPassword) {
    if (!passwordRegex.test(nextPassword)) {
      return NextResponse.json(
        { error: "Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt." },
        { status: 400 }
      );
    }

    updates.passwordHash = await hashPassword(nextPassword);
    changedFields.push("password");
    details.passwordUpdated = true;
  }

  if (typeof parsed.data.role !== "undefined" && parsed.data.role !== targetUser.role) {
    if (!isSpAdminRole(result.user.role)) {
      return NextResponse.json({ error: "Chỉ SPADMIN mới có quyền thay đổi role user." }, { status: 403 });
    }

    updates.role = parsed.data.role;
    changedFields.push("role");
    details.previousRole = targetUser.role;
    details.nextRole = parsed.data.role;
  }

  if (typeof parsed.data.isLocked !== "undefined" && parsed.data.isLocked !== targetUser.isLocked) {
    if (!isSpAdminRole(result.user.role)) {
      return NextResponse.json({ error: "Chỉ SPADMIN mới có quyền khóa/mở khóa tài khoản." }, { status: 403 });
    }

    updates.isLocked = parsed.data.isLocked;
    changedFields.push("isLocked");
    details.isLocked = parsed.data.isLocked;
  }

  if (typeof parsed.data.balance !== "undefined" && parsed.data.balance !== targetUser.balance) {
    updates.balance = parsed.data.balance;
    changedFields.push("balance");
    details.previousBalance = targetUser.balance;
    details.nextBalance = parsed.data.balance;
    details.amountChange = parsed.data.balance - targetUser.balance;
  }

  if (changedFields.length === 0) {
    return NextResponse.json({ error: "Không có thay đổi nào để cập nhật." }, { status: 400 });
  }

  const isSpAdmin = result.user.role === "SPADMIN";
  const amountChange = typeof updates.balance === "number" ? updates.balance - targetUser.balance : 0;
  
  if (!isSpAdmin) {
    if (amountChange < 0) {
      return NextResponse.json({ error: "ADMIN chỉ có thể cộng thêm số dư, không được trừ." }, { status: 400 });
    }

    // Quick non-transactional check
    const lockedCommission = await getLockedAdminCommission(result.user.id);
    if (amountChange > 0 && result.user.balance - lockedCommission < amountChange) {
      return NextResponse.json({ error: `Số dư khả dụng Admin không đủ. Cần ${amountChange.toLocaleString()} nhưng bị tạm giữ một phần quỹ từ đơn hàng.` }, { status: 400 });
    }
  }

  console.log(`[BalanceAdjustment] Operater: ${result.user.username} (${result.user.role}), Target: ${targetUser.username}, Change: ${amountChange}`);

  try {
    await prisma.$transaction(async (tx) => {
    // 1. Update user info
    await tx.user.update({
      where: { id: userId },
      data: updates,
    });

    if (amountChange !== 0) {
      // 2. Only deduct from operator if they are NOT SPADMIN
      if (!isSpAdmin && amountChange > 0) {
        const txLockedCommission = await getLockedAdminCommission(result.user.id, tx);
        const minRequired = amountChange + txLockedCommission;

        const updateResult = await tx.user.updateMany({
          where: { id: result.user.id, balance: { gte: minRequired } },
          data: { balance: { decrement: amountChange } },
        });

        if (updateResult.count === 0) {
            throw new Error(`Số dư khả dụng của Admin không đủ để cấp cho người dùng do một phần bị tạm giữ (hoặc lỗi song song).`);
        }

        // Admin sender transaction
        await tx.transaction.create({
          data: {
            userId: result.user.id,
            amount: -amountChange,
            type: "ADMIN_ADJUSTMENT",
            note: `Chuyển tiền cho User ${targetUser.username}: -${amountChange} VND`,
          },
        });
      }

      // 3. User receiver/adjustment transaction
      await tx.transaction.create({
        data: {
          userId,
          amount: amountChange,
          type: "ADMIN_ADJUSTMENT",
          note: isSpAdmin 
            ? `Điều chỉnh số dư bởi SPADMIN ${result.user.username}: ${amountChange > 0 ? "+" : ""}${amountChange} VND`
            : `Nhận tiền từ Admin ${result.user.username}: +${amountChange} VND`,
        },
      });
    }

    // 4. Audit Log
    await tx.auditLog.create({
      data: {
        adminId: result.user.id,
        action: isSpAdmin ? "SPADMIN_ADJUST_BALANCE" : "ADMIN_TRANSFER_BALANCE",
        targetType: "USER",
        targetId: userId,
        details: JSON.stringify(details),
      },
    });
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/transactions");
  revalidatePath("/admin/logs");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");

  return NextResponse.json({ success: true });
} catch (error: any) {
  if (error.message?.includes("Số dư Admin không đủ")) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ error: "Cập nhật thất bại" }, { status: 500 });
}
}