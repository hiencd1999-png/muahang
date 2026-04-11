import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { createNotification } from "@/lib/notifications";
import { createAuditLog } from "@/lib/audit";
import { isSpAdminRole } from "@/lib/roles";
import { releaseExpiredProcessingOrders } from "@/lib/order-assignment";

const schema = z.object({
  orderId: z.number().int().positive(),
  status: z.enum(["PROCESSING", "ORDER_PLACED", "TRACKING_GENERATED", "DELIVERED", "CANCELED"]),
  spcCookie: z.string().optional(),
  cancelReason: z.string().trim().max(300).optional(),
});

const allowedTransitions: Record<string, string[]> = {
  PENDING: ["PROCESSING", "CANCELED"],
  PROCESSING: ["ORDER_PLACED", "CANCELED"],
  ORDER_PLACED: ["CANCELED"],
  TRACKING_GENERATED: ["CANCELED"],
  DELIVERED: [],
  CANCELED: [],
};

export async function PUT(request: Request) {
  const result = await requireApiUser("ADMIN");

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);

  await releaseExpiredProcessingOrders();

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload cập nhật đơn không hợp lệ." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
  });

  if (!order) {
    return NextResponse.json({ error: "Đơn hàng không tồn tại." }, { status: 404 });
  }

  if (!allowedTransitions[order.status].includes(parsed.data.status)) {
    return NextResponse.json({ error: "Chuyển trạng thái không hợp lệ." }, { status: 400 });
  }

  const canManageAllOrders = isSpAdminRole(result.user.role);

  if (!canManageAllOrders && order.approvedByAdminId && order.approvedByAdminId !== result.user.id) {
    return NextResponse.json(
      { error: "Bạn chỉ có thể xử lý các đơn do mình đã duyệt hoặc được Booking." },
      { status: 403 }
    );
  }

  // Validate cookie when transitioning to ORDER_PLACED
  if (parsed.data.status === "ORDER_PLACED") {
    if (!parsed.data.spcCookie || !parsed.data.spcCookie.trim()) {
      return NextResponse.json({ 
        error: "Vui lòng cung cấp cookie SPC_ST để chuyển sang 'Đã đặt đơn'." 
      }, { status: 400 });
    }
    if (!parsed.data.spcCookie.includes("SPC_ST")) {
      return NextResponse.json({ 
        error: "Cookie không hợp lệ. Vui lòng cung cấp cookie SPC_ST đầy đủ." 
      }, { status: 400 });
    }
  }

  if (parsed.data.status === "CANCELED" && !parsed.data.cancelReason?.trim()) {
    return NextResponse.json(
      { error: "Bắt buộc nhập lý do hủy đơn để user có thể theo dõi." },
      { status: 400 }
    );
  }

  const shouldRefund = parsed.data.status === "CANCELED" && order.status !== "CANCELED" && order.status !== "DELIVERED";

  const updateData: Record<string, any> = { 
    status: parsed.data.status,
  };

  if (order.status === "PENDING" && parsed.data.status === "PROCESSING") {
    updateData.approvedByAdminId = result.user.id;
    updateData.processingStartedAt = new Date();
  } else if (!order.approvedByAdminId && order.status !== "PENDING") {
    updateData.approvedByAdminId = result.user.id;
  }

  if (parsed.data.status !== "PROCESSING") {
    updateData.processingStartedAt = null;
  }

  // Store cookie when transitioning to ORDER_PLACED
  if (parsed.data.status === "ORDER_PLACED") {
    updateData.spcCookie = parsed.data.spcCookie;
  }

  if (parsed.data.status === "CANCELED") {
    updateData.cancelReason = parsed.data.cancelReason?.trim();
  } else {
    updateData.cancelReason = null;
  }

  const shouldPayCommission = parsed.data.status === "DELIVERED" && order.status !== "DELIVERED" && (updateData.approvedByAdminId || order.approvedByAdminId);
  const commissionAdminId = updateData.approvedByAdminId || order.approvedByAdminId;
  const commissionAmt = Math.floor(order.total * 0.95);

  try {
    await prisma.$transaction(async (tx) => {
      // Optimistic Concurrency Control: Ensure status is exactly what we validated
      const updateResult = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: updateData,
      });

      if (updateResult.count === 0) {
        throw new Error("ConcurrencyError");
      }

      if (shouldRefund) {
        await tx.user.update({
          where: { id: order.userId },
          data: { balance: { increment: order.total } },
        });
        await tx.transaction.create({
          data: {
            userId: order.userId,
            amount: order.total,
            type: TransactionType.ORDER_REFUND,
            note: `Hoàn tiền đơn hàng #${order.id}`,
          },
        });
      }

      if (shouldPayCommission && commissionAdminId) {
        await tx.user.update({
          where: { id: commissionAdminId },
          data: { balance: { increment: commissionAmt } },
        });
        await tx.transaction.create({
          data: {
            userId: commissionAdminId,
            amount: commissionAmt,
            type: TransactionType.ADMIN_ADJUSTMENT,
            note: `Hoa hồng xử lý đơn giao thành công #${order.id} (95% của ${order.total.toLocaleString("vi-VN")}đ)`,
          },
        });
      }
    });
  } catch (error: any) {
    if (error.message === "ConcurrencyError") {
      return NextResponse.json({ error: "Thao tác không thành công do trạng thái đơn đã bị thay đổi trước đó." }, { status: 409 });
    }
    throw error;
  }

  revalidatePath("/admin/orders");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orders");

  if (parsed.data.status === "CANCELED") {
    await createNotification(
      order.userId,
      "ORDER_CANCELED",
      `Đơn hàng #${order.id} đã bị hủy`,
      `Lý do hủy: ${parsed.data.cancelReason?.trim()}`,
      `/dashboard/orders?orderId=${order.id}`
    );
  } else if (shouldPayCommission && commissionAdminId) {
    await createNotification(
      commissionAdminId,
      "BALANCE_CHANGED",
      "Hoa hồng hoàn thành đơn",
      `Bạn được cộng ${commissionAmt.toLocaleString("vi-VN")}đ từ đơn #${order.id}.`,
      `/admin/orders?orderId=${order.id}`
    );
  }

  const { sendTelegramNotification } = await import("@/lib/telegram");
  const statusToVi: Record<string, string> = {
    "PROCESSING": "Đang Xử Lý",
    "ORDER_PLACED": "Đã Đặt Đơn",
    "TRACKING_GENERATED": "Có Mã Vận Đơn",
    "DELIVERED": "Đã Giao Về Kho",
    "CANCELED": "Đã Hủy"
  };
  const humanStatus = statusToVi[parsed.data.status] || parsed.data.status.replace(/_/g, ' ');

  let teleMsg = `📦 *Đơn hàng #${order.id}*\nTrạng thái mới: ${humanStatus}`;
  if (parsed.data.status === "CANCELED") {
      teleMsg += `\nLý do: ${parsed.data.cancelReason?.trim()}`;
  }
  await sendTelegramNotification(order.userId, teleMsg, "USER_ORDER");

  await createAuditLog({
    actorId: result.user.id,
    action: `ADMIN_UPDATE_ORDER_STATUS_${parsed.data.status}`,
    targetType: "ORDER",
    targetId: order.id,
    details: {
      previousStatus: order.status,
      nextStatus: parsed.data.status,
      approvedByAdminId: updateData.approvedByAdminId ?? order.approvedByAdminId ?? null,
    },
  });

  return NextResponse.json({ success: true });
}
