import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { USER_ROLES, isSpAdminRole, type UserRole } from "@/lib/roles";
import { requireApiUser } from "@/lib/session";

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

const schema = z
  .object({
    password: z.string().optional(),
    role: z.enum(USER_ROLES).optional(),
    balance: z.number().int().min(0).optional(),
  })
  .refine((data) => Boolean(data.password?.trim()) || typeof data.role !== "undefined" || typeof data.balance !== "undefined", {
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

  const updates: { passwordHash?: string; role?: UserRole; balance?: number } = {};
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

  details.changedFields = changedFields;
  const onlyBalanceChange = changedFields.length === 1 && changedFields[0] === "balance";

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: updates,
    }),
    ...(typeof updates.balance === "number"
      ? [
          prisma.transaction.create({
            data: {
              userId,
              amount: updates.balance - targetUser.balance,
              type: "ADMIN_ADJUSTMENT",
              note: `Điều chỉnh số dư bởi ${result.user.username}: ${targetUser.balance} -> ${updates.balance} VND`,
            },
          }),
        ]
      : []),
    prisma.auditLog.create({
      data: {
        adminId: result.user.id,
        action: onlyBalanceChange ? "ADMIN_ADJUST_USER_BALANCE" : "ADMIN_UPDATE_USER",
        targetType: "USER",
        targetId: userId,
        details: JSON.stringify(details),
      },
    }),
  ]);

  revalidatePath("/admin/users");
  revalidatePath("/admin/transactions");
  revalidatePath("/admin/logs");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");

  return NextResponse.json({ success: true });
}