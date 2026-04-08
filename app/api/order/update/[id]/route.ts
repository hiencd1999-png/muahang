import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/notifications";

const updateOrderSchema = z.object({
  phone: z.string().trim().min(8),
  address: z.string().trim().min(8),
  variant: z.string().trim().min(1).max(120),
  note: z.string().trim().max(500).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireApiUser();

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { id } = await params;
  const orderId = Number(id);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "Order ID không hợp lệ." }, { status: 400 });
  }

  const body = await request.json();
  const parsed = updateOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu cập nhật đơn không hợp lệ." }, { status: 400 });
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

  if (order.status !== "PENDING") {
    return NextResponse.json({ error: "Đơn đã được duyệt, không thể chỉnh sửa." }, { status: 400 });
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      phone: parsed.data.phone,
      address: parsed.data.address,
      variant: parsed.data.variant,
      note: parsed.data.note,
    },
  });

  revalidatePath("/dashboard/orders");
  revalidatePath("/admin/orders");

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireApiUser();

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { id } = await params;
  const orderId = Number(id);

  if (!Number.isInteger(orderId) || orderId <= 0) {
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

  if (order.status !== "PENDING") {
    return NextResponse.json(
      { error: "Chỉ có thể tự hủy đơn khi đang chờ duyệt." },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        status: "CANCELED",
        cancelReason: "User hủy đơn",
      },
    }),
    prisma.user.update({
      where: { id: result.user.id },
      data: { balance: { increment: order.total } },
    }),
    prisma.transaction.create({
      data: {
        userId: result.user.id,
        amount: order.total,
        type: TransactionType.ORDER_REFUND,
        note: `User hủy đơn hàng #${order.id}`,
      },
    }),
  ]);

  await createNotification(
    result.user.id,
    "ORDER_CANCELED",
    `Đơn hàng #${order.id} đã hủy`,
    "Lý do hủy: User hủy đơn",
    `/dashboard/orders?orderId=${order.id}`
  );

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orders");
  revalidatePath("/admin/orders");

  return NextResponse.json({ success: true });
}
