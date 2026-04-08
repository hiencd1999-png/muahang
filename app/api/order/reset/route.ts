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

    if (result.user.balance < order.total) {
      return NextResponse.json({ error: "Số dư không đủ để đặt lại đơn hàng này." }, { status: 400 });
    }

    await prisma.$transaction([
      // Trừ tiền lại
      prisma.user.update({
        where: { id: result.user.id },
        data: { balance: { decrement: order.total } },
      }),
      // Cập nhật trạng thái đơn
      prisma.order.update({
        where: { id: order.id },
        data: {
          status: "PENDING",
          cancelReason: null, // Xóa lý do hủy cũ
          updatedAt: new Date(),
        },
      }),
      // Ghi giao dịch
      prisma.transaction.create({
        data: {
          userId: result.user.id,
          amount: -order.total,
          type: TransactionType.ORDER_DEBIT,
          note: `Đặt lại đơn hàng bị hủy #${order.id}`,
        },
      }),
    ]);

    await createNotification(
      result.user.id,
      "ORDER_CREATED",
      `Đơn hàng #${order.id} đã được đặt lại`,
      `Bạn vừa đặt lại đơn hàng đã hủy. Trạng thái hiện tại: Chờ duyệt.`,
      `/dashboard/orders?orderId=${order.id}`
    );

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/orders");
    revalidatePath("/admin/orders");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset order error:", error);
    return NextResponse.json({ error: "Có lỗi khi đặt lại đơn hàng." }, { status: 500 });
  }
}
