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

    await prisma.$transaction(async (tx) => {
        // Kiểm tra độc quyền trạng thái đơn hàng (chống spam F5)
        const currentOrder = await tx.order.findUnique({ where: { id: order.id } });
        if (!currentOrder || currentOrder.status !== "CANCELED") {
            throw new Error("Chỉ có thể đặt lại đơn hàng đã bị hủy. Lệnh đã bị xử lý.");
        }

        // Kiểm tra độc quyền số dư (chống spam F5 vượt quá số dư tịnh)
        const currentUser = await tx.user.findUnique({ where: { id: result.user.id } });
        if (!currentUser || currentUser.balance < currentOrder.total) {
            throw new Error("Số dư không đủ để đặt lại đơn hàng này.");
        }

        // Trừ tiền
        await tx.user.update({
            where: { id: result.user.id },
            data: { balance: { decrement: currentOrder.total } },
        });

        // Cập nhật trạng thái
        await tx.order.update({
            where: { id: order.id },
            data: {
              status: "PENDING",
              cancelReason: null, 
              updatedAt: new Date(),
            },
        });

        // Ghi transaction log
        await tx.transaction.create({
            data: {
              userId: result.user.id,
              amount: -currentOrder.total,
              type: TransactionType.ORDER_DEBIT,
              note: `Đặt lại đơn hàng bị hủy #${order.id}`,
            },
        });
    });

    await createNotification(
      result.user.id,
      "ORDER_CREATED",
      `Đơn hàng #${order.id} đã được đặt lại`,
      `Bạn vừa đặt lại đơn hàng đã hủy. Trạng thái hiện tại: Chờ duyệt.`,
      `/dashboard/orders?orderId=${order.id}`
    );

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
