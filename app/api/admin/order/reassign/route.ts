import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { releaseExpiredProcessingOrders } from "@/lib/order-assignment";

const schema = z.object({
  orderId: z.number().int().positive(),
  adminId: z.number().int().positive(),
});

export async function PATCH(request: Request) {
  const result = await requireApiUser("SPADMIN");

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu đổi admin phụ trách không hợp lệ." }, { status: 400 });
  }

  await releaseExpiredProcessingOrders();

  const [order, nextAdmin] = await Promise.all([
    prisma.order.findUnique({ where: { id: parsed.data.orderId } }),
    prisma.user.findFirst({
      where: {
        id: parsed.data.adminId,
        role: { in: ["ADMIN", "SPADMIN"] },
      },
      select: { id: true, username: true, fullName: true, role: true },
    }),
  ]);

  if (!order) {
    return NextResponse.json({ error: "Đơn hàng không tồn tại." }, { status: 404 });
  }

  if (order.status === "DELIVERED") {
    return NextResponse.json({ error: "Đơn đã giao không thể đổi phụ trách." }, { status: 400 });
  }

  if (!nextAdmin) {
    return NextResponse.json({ error: "Admin phụ trách mới không hợp lệ." }, { status: 400 });
  }

  const previousAdminId = order.approvedByAdminId;

  if (previousAdminId === nextAdmin.id) {
    return NextResponse.json({ success: true });
  }

  const isPendingOrder = order.status === "PENDING";
  const isProcessingOrder = order.status === "PROCESSING";

  const updateResult = await prisma.order.updateMany({
    where: { id: order.id, status: order.status },
    data: {
      approvedByAdminId: nextAdmin.id,
      status: isPendingOrder ? "PROCESSING" : order.status,
      processingStartedAt: isPendingOrder || isProcessingOrder ? new Date() : null,
    },
  });

  if (updateResult.count === 0) {
    return NextResponse.json({ error: "Lỗi! Trạng thái đơn đã bị thay đổi trong lúc thao tác, hãy tải lại trang." }, { status: 409 });
  }

  await createAuditLog({
    actorId: result.user.id,
    action: "SPADMIN_REASSIGN_ORDER_OWNER",
    targetType: "ORDER",
    targetId: order.id,
    details: {
      previousAdminId,
      nextAdminId: nextAdmin.id,
      previousStatus: order.status,
      nextStatus: isPendingOrder ? "PROCESSING" : order.status,
    },
  });

  revalidatePath("/admin/orders");
  revalidatePath("/dashboard/orders");

  try {
    const { sendTelegramNotification } = await import("@/lib/telegram");
    const notifyOldAdminMsg = `♻️ *Đơn hàng #${order.id} được đổi phụ trách*\nĐơn này đã được chuyển khỏi danh sách của bạn.`;
    const notifyNewAdminMsg = `♻️ *Bạn được phân công Đơn hàng #${order.id}*\nĐơn đã được chuyển qua bạn phụ trách. Vui lòng vào xử lý.`;
    const notifyUserMsg = `♻️ *Đơn hàng #${order.id}*\nĐơn của bạn đã được chuyển cho nhân viên xử lý mới: ${nextAdmin.fullName || nextAdmin.username}.`;
    
    await sendTelegramNotification(order.userId, notifyUserMsg, "USER_ORDER");
    await sendTelegramNotification(nextAdmin.id, notifyNewAdminMsg, "ADMIN_ORDER");
    if (previousAdminId) {
      await sendTelegramNotification(previousAdminId, notifyOldAdminMsg, "ADMIN_ORDER");
    }
  } catch (error) {
    console.error("Failed to send telegram notification for order reassign", error);
  }

  return NextResponse.json({ success: true });
}