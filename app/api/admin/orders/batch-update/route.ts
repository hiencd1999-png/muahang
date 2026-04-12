import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";

export async function POST(request: NextRequest) {
  const result = await requireApiUser("ADMIN");
  if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const user = result.user;

  const { orderIds, status } = await request.json();

  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return NextResponse.json({ error: "orderIds is required" }, { status: 400 });
  }

  if (orderIds.length > 200) {
    return NextResponse.json({ error: "Chỉ được phép cập nhật hàng loạt tối đa 200 đơn mỗi lần" }, { status: 400 });
  }

  if (!status || !["PENDING", "PROCESSING", "ORDER_PLACED", "TRACKING_GENERATED", "DELIVERED", "CANCELED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    // Fetch all orders to be updated
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
    });

    if (orders.length === 0) {
      return NextResponse.json({ error: "No orders found" }, { status: 404 });
    }

    // Process each order update
    const results = (await Promise.all(
      orders.map(async (order) => {
        return prisma.$transaction(async (tx) => {
           // Khoá Row Đơn hàng để chặn Hacker spam Lệnh kép (Double-spend refunds / commissions)
           const currentOrder = await tx.order.findUnique({ where: { id: order.id } });
           if (!currentOrder || ["CANCELED", "DELIVERED"].includes(currentOrder.status)) {
               return null;
           }

           // Handle refunds when canceling
           if (status === "CANCELED") {
              const updateResult = await tx.order.updateMany({
                where: { id: currentOrder.id, status: currentOrder.status },
                data: { status, processingStartedAt: null },
              });

              if (updateResult.count === 0) return null;

              await tx.transaction.create({
                data: {
                  userId: currentOrder.userId,
                  amount: currentOrder.total,
                  type: "ORDER_REFUND",
                  note: `Hoàn tiền cho đơn #${currentOrder.id}`,
                },
              });
              await tx.user.update({
                where: { id: currentOrder.userId },
                data: { balance: { increment: currentOrder.total } },
              });
              return currentOrder;
           }

           // Chặn cướp đơn Booking đích danh (SPADMIN được phép vượt qua)
           if (
             user.role !== "SPADMIN" &&
             currentOrder.status === "PENDING" && 
             status === "PROCESSING" && 
             currentOrder.approvedByAdminId && 
             currentOrder.approvedByAdminId !== user.id
           ) {
             return currentOrder;
           }

           // Handle commission when manually marking as DELIVERED
           if (status === "DELIVERED" && currentOrder.approvedByAdminId) {
             const commission = Math.floor(currentOrder.total * 0.95);
             const updateResult = await tx.order.updateMany({
               where: { id: currentOrder.id, status: currentOrder.status },
               data: { status, processingStartedAt: null },
             });

             if (updateResult.count === 0) return null;
             await tx.user.update({
               where: { id: currentOrder.approvedByAdminId },
               data: { balance: { increment: commission } },
             });
             await tx.transaction.create({
               data: {
                 userId: currentOrder.approvedByAdminId,
                 amount: commission,
                 type: "ADMIN_ADJUSTMENT",
                 note: `Hoa hồng xử lý đơn giao thành công #${currentOrder.id} (95% của ${currentOrder.total.toLocaleString("vi-VN")}đ)`,
               },
             });
             await tx.notification.create({
               data: {
                 userId: currentOrder.approvedByAdminId,
                 type: "BALANCE_CHANGED",
                 title: "Hoa hồng hoàn thành đơn",
                 message: `Bạn được cộng ${commission.toLocaleString("vi-VN")}đ từ đơn #${currentOrder.id}.`,
                 link: `/admin/orders?orderId=${currentOrder.id}`,
               },
             });
             return currentOrder;
           }

           // Regular status update
           const updateResult = await tx.order.updateMany({
             where: { id: currentOrder.id, status: currentOrder.status },
             data: {
               status,
               approvedByAdminId: status === "PROCESSING" ? user.id : status === "PENDING" ? null : currentOrder.approvedByAdminId,
               processingStartedAt: status === "PROCESSING" ? new Date() : null,
             },
           });

           if (updateResult.count === 0) return null;
           return currentOrder;
        });
      })
    )).filter(Boolean);

    // Log the action
    await prisma.auditLog.create({
      data: {
        adminId: user.id,
        action: `BULK_UPDATE_ORDERS_TO_${status}`,
        targetType: "ORDER",
        targetId: 0,
        details: JSON.stringify({ orderIds, status, count: results.length }),
      },
    });

    // Bắn thông báo Telegram cho hàng loạt đơn đã cập nhật
    if (results.length > 0) {
        try {
            const { sendTelegramNotification } = await import("@/lib/telegram");
            const statusToVi: Record<string, string> = {
                "PROCESSING": "Đang Xử Lý",
                "ORDER_PLACED": "Đã Đặt Đơn",
                "TRACKING_GENERATED": "Có Mã Vận Đơn",
                "DELIVERED": "Đã Giao Về Kho",
                "CANCELED": "Đã Hủy"
            };
            const humanStatus = statusToVi[status] || status.replace(/_/g, ' ');
            
            for (const order of results) {
                if (!order) continue;
                let teleMsg = `📦 *Cập nhật hàng loạt: Đơn #${order.id}*\nTrạng thái mới: ${humanStatus}`;
                await sendTelegramNotification(order.userId, teleMsg, "USER_ORDER");
                
                // Nếu đơn đang có admin phụ trách (kể cả admin vừa nhận đơn (PROCESSING) hoặc admin cũ)
                const targetAdminId = status === "PROCESSING" ? user.id : order.approvedByAdminId;
                if (targetAdminId) {
                    await sendTelegramNotification(targetAdminId, teleMsg, "ADMIN_ORDER");
                }
            }
        } catch (error) {
            console.error("Batch update Telegram notify error:", error);
        }
    }

    return NextResponse.json({
      message: `Updated ${results.length} orders`,
      updated: results.length,
    });
  } catch (error) {
    console.error("Batch update error:", error);
    return NextResponse.json({ error: "Failed to update orders" }, { status: 500 });
  }
}
