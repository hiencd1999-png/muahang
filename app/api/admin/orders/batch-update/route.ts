import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function POST(request: NextRequest) {
  const user = await requireUser("ADMIN");

  const { orderIds, status } = await request.json();

  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return NextResponse.json({ error: "orderIds is required" }, { status: 400 });
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
    const results = await Promise.all(
      orders.map(async (order) => {
        // Handle refunds when canceling
        if (status === "CANCELED" && ["PENDING", "PROCESSING"].includes(order.status)) {
          // Create refund transaction
          const updatedOrder = await prisma.order.update({
            where: { id: order.id },
            data: {
              status,
              processingStartedAt: null,
            },
          });

          await prisma.transaction.create({
            data: {
              userId: order.userId,
              amount: order.total,
              type: "ORDER_REFUND",
              note: `Hoàn tiền cho đơn #${order.id}`,
            },
          });

          // Update user balance
          await prisma.user.update({
            where: { id: order.userId },
            data: { balance: { increment: order.total } },
          });

          return updatedOrder;
        }

        // Chặn cướp đơn Booking đích danh
        if (
          order.status === "PENDING" && 
          status === "PROCESSING" && 
          order.approvedByAdminId && 
          order.approvedByAdminId !== user.id
        ) {
          // Bỏ qua không xét duyệt đơn này, trả về nguyên dạng
          return order;
        }

        // Handle commission when manually marking as DELIVERED
        if (status === "DELIVERED" && order.status !== "DELIVERED" && order.approvedByAdminId) {
          const commission = Math.floor(order.total * 0.95);
          const updatedOrder = await prisma.order.update({
            where: { id: order.id },
            data: { status, processingStartedAt: null },
          });

          await prisma.user.update({
            where: { id: order.approvedByAdminId },
            data: { balance: { increment: commission } },
          });

          await prisma.transaction.create({
            data: {
              userId: order.approvedByAdminId,
              amount: commission,
              type: "ADMIN_ADJUSTMENT",
              note: `Hoa hồng xử lý đơn giao thành công #${order.id} (95% của ${order.total.toLocaleString("vi-VN")}đ)`,
            },
          });

          await prisma.notification.create({
            data: {
              userId: order.approvedByAdminId,
              type: "BALANCE_CHANGED",
              title: "Hoa hồng hoàn thành đơn",
              message: `Bạn được cộng ${commission.toLocaleString("vi-VN")}đ từ đơn #${order.id}.`,
              link: `/admin/orders?orderId=${order.id}`,
            },
          });

          return updatedOrder;
        }

        // Regular status update
        return await prisma.order.update({
          where: { id: order.id },
          data: {
            status,
            approvedByAdminId: status === "PROCESSING" ? user.id : status === "PENDING" ? null : order.approvedByAdminId,
            processingStartedAt: status === "PROCESSING" ? new Date() : null,
          },
        });
      })
    );

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

    return NextResponse.json({
      message: `Updated ${results.length} orders`,
      updated: results.length,
    });
  } catch (error) {
    console.error("Batch update error:", error);
    return NextResponse.json({ error: "Failed to update orders" }, { status: 500 });
  }
}
