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
    select: { id: true, status: true, complaintStatus: true, updatedAt: true },
  });

  if (orders.length === 0) {
    return NextResponse.json({ error: "Không tìm thấy đơn phù hợp để xóa." }, { status: 404 });
  }

  const unsafeOrder = orders.find((order) => {
    if (order.status !== "CANCELED" && order.status !== "DELIVERED") return true;
    if (order.complaintStatus === "PENDING") return true;
    return false;
  });

  if (unsafeOrder) {
    return NextResponse.json({ error: "Chỉ được xóa các đơn Đã hoàn thành/Đã hủy và không trong quá trình khiếu nại." }, { status: 400 });
  }

  await prisma.order.updateMany({
    where: {
      userId: result.user.id,
      id: { in: orders.map((order) => order.id) },
    },
    data: {
      isHiddenByUser: true
    }
  });

  await createAuditLog({
    actorId: result.user.id,
    action: "USER_DELETE_SAFE_ORDERS",
    targetType: "ORDER",
    details: { orderIds: orders.map((order) => order.id), count: orders.length },
  });

  revalidatePath("/dashboard/orders");
  revalidatePath("/admin/orders");

  return NextResponse.json({ success: true, deleted: orders.length });
}
