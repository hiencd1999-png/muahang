import { NextRequest, NextResponse } from "next/server";
import { TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  const result = await requireApiUser();

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  try {
    const { orderId } = await request.json();
    
    if (!orderId || typeof orderId !== "number") {
      return NextResponse.json({ error: "Order ID không hợp lệ." }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: result.user.id,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
    }

    if (order.status !== "CANCELED") {
      return NextResponse.json({ error: "Chỉ có thể đặt lại đơn hàng đã bị hủy." }, { status: 400 });
    }

    if (order.cancelReason && order.cancelReason.includes("(Đã đặt lại)")) {
      return NextResponse.json({ error: "Đơn hàng này đã được đặt lại rồi." }, { status: 400 });
    }

    const newCancelReason = order.cancelReason ? `${order.cancelReason} (Đã đặt lại)` : "(Đã đặt lại)";
    let newOrderId = -1;

    await prisma.$transaction(async (tx) => {
        // Kiểm tra độc quyền số dư và trừ tiền (chống spam F5 vượt quá số dư tịnh)
        const userUpdateResult = await tx.user.updateMany({
            where: { id: result.user.id, balance: { gte: order.total } },
            data: { balance: { decrement: order.total } },
        });

        if (userUpdateResult.count === 0) {
            throw new Error("Số dư không đủ để đặt lại đơn hàng này (hoặc có giao dịch song song).");
        }

        // Cập nhật trạng thái (chống spam thao tác 2 lần)
        const orderUpdateResult = await tx.order.updateMany({
            where: { id: order.id, status: "CANCELED", cancelReason: order.cancelReason },
            data: {
              cancelReason: newCancelReason, 
              updatedAt: new Date(),
            },
        });

        if (orderUpdateResult.count === 0) {
            throw new Error("Chỉ có thể đặt lại đơn hàng đã bị hủy. Lệnh đã bị xử lý.");
        }

        const newOrder = await tx.order.create({
            data: {
              userId: result.user.id,
              productLink: order.productLink,
              productName: order.productName,
              shopId: order.shopId,
              variant: order.variant,
              quantity: order.quantity,
              phone: order.phone,
              address: order.address,
              note: order.note,
              voucherCode: order.voucherCode,
              voucherLabel: order.voucherLabel,
              unitPrice: order.unitPrice,
              total: order.total,
              status: "PENDING",
              approvedByAdminId: order.approvedByAdminId,
              isLockerPickup: order.isLockerPickup,
            }
        });
        
        newOrderId = newOrder.id;

        // Ghi transaction log
        await tx.transaction.create({
            data: {
              userId: result.user.id,
              amount: -order.total,
              type: TransactionType.ORDER_DEBIT,
              note: `Đặt lại đơn hàng bị hủy #${order.id} (Tạo đơn mới #${newOrder.id})`,
            },
        });
    });

    await createNotification(
      result.user.id,
      "ORDER_CREATED",
      `Đơn hàng #${newOrderId} đã được tạo (Đặt lại)`,
      `Bạn vừa đặt lại đơn hàng đã hủy #${order.id}. Trạng thái hiện tại: Chờ duyệt.`,
      `/dashboard/orders?orderId=${newOrderId}`
    );

    try {
        const { sendTelegramNotification, broadcastToAdmins } = await import("@/lib/telegram");
        const adminOrderLink = `${process.env.NEXT_PUBLIC_APP_URL || "https://datdon.otistx.com"}/admin/orders?orderId=${newOrderId}&action=view`;
        
        await sendTelegramNotification(
            result.user.id,
            `♻️ *Khôi phục đơn thành công*\nĐơn hàng bị huỷ #${order.id} của bạn đã được đặt lại thành đơn mới #${newOrderId}.\n- Phân bổ lại phí dịch vụ: ${(order.total/1000).toFixed(0)}k\n- Đang chờ Quản trị viên duyệt lại.`,
            "USER_ORDER"
        );

        if (order.approvedByAdminId) {
            await sendTelegramNotification(
                order.approvedByAdminId,
                `♻️ *Đơn hàng được Khôi phục!*\nKhách hàng ${result.user.username} vừa bấm Đặt Lại / Khôi phục đơn bị huỷ #${order.id} tạo thành đơn MỚI #${newOrderId}.\nVì đơn này bạn đang phụ trách, hệ thống đã ném lại vào hàng đợi của bạn.\n- *🔗 Mở chi tiết:* [Click để xem](${adminOrderLink})`,
                "ADMIN_ORDER"
            );
        } else {
            await broadcastToAdmins(
                `♻️ *Đơn hàng bị huỷ vừa được đặt lại (Đơn mới: #${newOrderId})*\n- Mã đơn cũ: #${order.id}\n- Sản phẩm: ${order.productName}\n- *🔗 Mở chi tiết:* [Click để xem và Nhận đơn](${adminOrderLink})`, 
                "ADMIN_ORDER"
            );
        }
    } catch (e) {
        console.error("Reset order Telegram notify error:", e);
    }

    revalidatePath("/dashboard");
    revalidatePath("/admin/orders");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message?.includes("Số dư không đủ") || error.message?.includes("Chỉ có thể đặt lại")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Reset order error:", error);
    return NextResponse.json({ error: "Có lỗi khi đặt lại đơn hàng." }, { status: 500 });
  }
}
