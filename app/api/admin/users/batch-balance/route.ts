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
    const targetUsers = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { role: true },
    });
    
    if (targetUsers.some((u) => u.role !== "USER")) {
      return NextResponse.json({ error: "ADMIN chỉ có thể thao tác với tài khoản USER." }, { status: 403 });
    }

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
        const txLockedCommission = await getLockedAdminCommission(admin.id, tx);
        const minRequired = totalTransfer + txLockedCommission;

        const updateResult = await tx.user.updateMany({
          where: { id: admin.id, balance: { gte: minRequired } },
          data: { balance: { decrement: totalTransfer } },
        });

        if (updateResult.count === 0) {
            throw new Error(`Số dư khả dụng Admin không đủ (hoặc lỗi giao dịch kép). Cần ${totalTransfer.toLocaleString()} VND nhưng một phần đang bị tạm giữ khiếu nại.`);
        }

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
        
        const operatorName = admin.fullName || admin.username;
        const opNote = isSpAdmin 
               ? `Điều chỉnh số dư hàng loạt bởi Hệ thống (SPADMIN ${operatorName}): ${amountChange > 0 ? "+" : ""}${amountChange.toLocaleString()} VND`
               : `Nhận tiền hàng loạt từ QTV (${operatorName}): +${amountChange.toLocaleString()} VND`;

        await tx.transaction.create({
          data: {
            userId,
            amount: amountChange,
            type: "ADMIN_ADJUSTMENT",
            note: opNote,
          },
        });
        
        await tx.notification.create({
          data: {
            userId,
            type: "BALANCE_CHANGED",
            title: "Cập nhật số dư",
            message: opNote,
          }
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

    try {
      const { sendTelegramNotification } = await import("@/lib/telegram");
      for (const userId of userIds) {
          const sign = amountChange > 0 ? "+" : "";
          await sendTelegramNotification(
              userId,
              `💰 *Biến Động Số Dư*\nSố dư của bạn vừa được cập nhật: ${sign}${amountChange.toLocaleString("vi-VN")}đ\nThao tác bởi: Quản trị viên hệ thống.`,
              "USER_DEPOSIT"
          );
      }
    } catch(e) {}


    return NextResponse.json({
      message: `Đã chuyển tiền cho ${results.length} người dùng thành công.`,
      updated: results.length,
      totalTransferred: totalTransfer,
    });
  } catch (error: any) {
    if (error.message?.includes("Số dư khả dụng Admin không đủ") || error.message?.includes("tạm giữ")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Batch balance update error:", error);
    return NextResponse.json({ error: "Thanh toán hàng loạt thất bại." }, { status: 500 });
  }
}
