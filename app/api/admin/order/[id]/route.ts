import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { releaseExpiredProcessingOrders } from "@/lib/order-assignment";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireApiUser("ADMIN");

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await releaseExpiredProcessingOrders();

  const { id } = await params;
  const orderId = parseInt(id, 10);
  if (Number.isNaN(orderId)) {
    return NextResponse.json({ error: "Order ID không hợp lệ." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: {
        select: {
          fullName: true,
          username: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Đơn hàng không tồn tại." }, { status: 404 });
  }

  const approvedByAdmin = order.approvedByAdminId
    ? await prisma.user.findUnique({
        where: { id: order.approvedByAdminId },
        select: { id: true, username: true, fullName: true },
      })
    : null;

  return NextResponse.json({
    order: {
      ...order,
      approvedByAdmin,
    },
  });
}
