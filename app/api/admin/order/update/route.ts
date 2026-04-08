import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { TransactionType } from "@prisma/client";
import { calculateOrderTotal } from "@/lib/order";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";

const schema = z.object({
  orderId: z.number().int().positive(),
  status: z.enum(["PROCESSING", "ORDER_PLACED", "TRACKING_GENERATED", "DELIVERED", "CANCELED"]),
  spcCookie: z.string().optional(),
});

const allowedTransitions: Record<string, string[]> = {
  PENDING: ["PROCESSING", "CANCELED"],
  PROCESSING: ["ORDER_PLACED", "CANCELED"],
  ORDER_PLACED: ["TRACKING_GENERATED", "CANCELED"],
  TRACKING_GENERATED: ["DELIVERED", "CANCELED"],
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

  const shouldRefund = parsed.data.status === "CANCELED" && (order.status === "PENDING" || order.status === "PROCESSING");

  const updateData: Record<string, any> = { 
    status: parsed.data.status,
  };

  // Store cookie when transitioning to ORDER_PLACED
  if (parsed.data.status === "ORDER_PLACED") {
    updateData.spcCookie = parsed.data.spcCookie;
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: updateData,
    }),
    ...(shouldRefund ? [
      prisma.user.update({
        where: { id: order.userId },
        data: { balance: { increment: calculateOrderTotal(order.quantity) } },
      }),
      prisma.transaction.create({
        data: {
          userId: order.userId,
          amount: calculateOrderTotal(order.quantity),
          type: TransactionType.ORDER_REFUND,
          note: `Hoàn tiền đơn hàng #${order.id}`,
        },
      }),
    ] : []),
  ]);

  revalidatePath("/admin/orders");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orders");

  return NextResponse.json({ success: true });
}
