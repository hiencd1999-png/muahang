import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { createAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  const result = await requireApiUser();

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { orderIds } = await request.json();

  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return NextResponse.json({ error: "Vui lòng chọn đơn đã hủy để xóa." }, { status: 400 });
  }

  const normalizedIds = orderIds.map(Number).filter(Number.isFinite);
  const orders = await prisma.order.findMany({
    where: {
      userId: result.user.id,
      id: { in: normalizedIds },
    },
    select: { id: true, status: true, updatedAt: true },
  });

  if (orders.length === 0) {
    return NextResponse.json({ error: "Không tìm thấy đơn phù hợp để xóa." }, { status: 404 });
  }

  const nonCanceledOrder = orders.find((order) => order.status !== "CANCELED");
  if (nonCanceledOrder) {
    return NextResponse.json({ error: "Chỉ được xóa các đơn đã hủy." }, { status: 400 });
  }

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const recentCanceledOrder = orders.find((order) => order.updatedAt > threeDaysAgo);
  if (recentCanceledOrder) {
    return NextResponse.json({ 
      error: "Đơn hàng hủy cần chờ 3 ngày để Admin xem xét khiếu nại trước khi bạn có thể xóa." 
    }, { status: 400 });
  }

  await prisma.order.deleteMany({
    where: {
      userId: result.user.id,
      id: { in: orders.map((order) => order.id) },
    },
  });

  await createAuditLog({
    actorId: result.user.id,
    action: "USER_DELETE_CANCELED_ORDERS",
    targetType: "ORDER",
    details: { orderIds: orders.map((order) => order.id), count: orders.length },
  });

  revalidatePath("/dashboard/orders");
  revalidatePath("/admin/orders");

  return NextResponse.json({ success: true, deleted: orders.length });
}
