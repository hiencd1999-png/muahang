import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getLockedAdminCommission } from "@/lib/admin-balance";

export async function POST(request: NextRequest) {
  const admin = await requireUser("ADMIN");

  const { userIds, amountChange } = await request.json();

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: "userIds is required" }, { status: 400 });
  }

  const isSpAdmin = admin.role === "SPADMIN";

  if (typeof amountChange !== "number" || amountChange === 0) {
    return NextResponse.json({ error: "Số tiền thay đổi không hợp lệ." }, { status: 400 });
  }

  if (!isSpAdmin) {
    if (amountChange <= 0) {
      return NextResponse.json({ error: "ADMIN chỉ có thể chuyển cộng thêm số dư, không được trừ." }, { status: 400 });
    }
    const totalTransfer = amountChange * userIds.length;
    
    // Quick non-transactional check
    const lockedCommission = await getLockedAdminCommission(admin.id);
    if (admin.balance - lockedCommission < totalTransfer) {
      return NextResponse.json({ error: `Số dư khả dụng Admin không đủ (sau khi trừ tạm giữ). Cần ${totalTransfer.toLocaleString()} VND nhưng chỉ có khả dụng ${(admin.balance - lockedCommission).toLocaleString()} VND.` }, { status: 400 });
    }
  }

  const totalTransfer = amountChange * userIds.length;
  console.log(`[BatchAdjustment] Operator: ${admin.username} (${admin.role}), TargetCount: ${userIds.length}, AmountPerUser: ${amountChange}`);

  try {
    const results = await prisma.$transaction(async (tx) => {
      // 1. Deduct from Admin ONLY if not SPADMIN
      if (!isSpAdmin && amountChange > 0) {
        const currentAdmin = await tx.user.findUnique({ where: { id: admin.id } });
        const txLockedCommission = await getLockedAdminCommission(admin.id, tx);
        const minRequired = totalTransfer + txLockedCommission;
        if (!currentAdmin || currentAdmin.balance < minRequired) {
            throw new Error(`Số dư khả dụng Admin không đủ. Cần ${totalTransfer.toLocaleString()} VND nhưng một phần đang bị tạm giữ khiếu nại.`);
        }

        await tx.user.update({
          where: { id: admin.id },
          data: { balance: { decrement: totalTransfer } },
        });

        // Add Transaction for Admin
        await tx.transaction.create({
          data: {
            userId: admin.id,
            amount: -totalTransfer,
            type: "ADMIN_ADJUSTMENT",
            note: `Chuyển tiền hàng loạt cho ${userIds.length} người dùng: -${totalTransfer} VND`,
          },
        });
      }

      // 3. Update all users and add their transactions
      const updatedUsers = [];
      for (const userId of userIds) {
        const u = await tx.user.update({
          where: { id: userId },
          data: { balance: { increment: amountChange } },
        });
        
        await tx.transaction.create({
          data: {
            userId,
            amount: amountChange,
            type: "ADMIN_ADJUSTMENT",
            note: isSpAdmin 
               ? `Điều chỉnh số dư hàng loạt bởi SPADMIN ${admin.username}: ${amountChange > 0 ? "+" : ""}${amountChange} VND`
               : `Nhận tiền hàng loạt từ Admin ${admin.username}: +${amountChange} VND`,
          },
        });
        updatedUsers.push(u);
      }

      // 4. Create Audit Log
      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          action: isSpAdmin ? "SPADMIN_TRANSFER_BALANCE" : "BULK_TRANSFER_BALANCE",
          targetType: "USER",
          targetId: 0,
          details: JSON.stringify({
            userIds,
            amountPerUser: amountChange,
            totalTransfer,
            count: updatedUsers.length,
          }),
        },
      });

      return updatedUsers;
    });

    return NextResponse.json({
      message: `Đã chuyển tiền cho ${results.length} người dùng thành công.`,
      updated: results.length,
      totalTransferred: totalTransfer,
    });
  } catch (error: any) {
    if (error.message?.includes("Số dư Admin không đủ")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Batch balance update error:", error);
    return NextResponse.json({ error: "Thanh toán hàng loạt thất bại." }, { status: 500 });
  }
}
