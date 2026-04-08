import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";

const schema = z.object({
  orderIds: z.array(z.number().int().positive()).min(1),
});

export async function POST(request: Request) {
  const result = await requireApiUser("SPADMIN");

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Danh sách đơn hàng cần xóa không hợp lệ." }, { status: 400 });
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: parsed.data.orderIds } },
    select: { id: true, status: true, userId: true },
  });

  if (orders.length === 0) {
    return NextResponse.json({ error: "Không tìm thấy đơn hàng để xóa." }, { status: 404 });
  }

  await prisma.order.deleteMany({
    where: { id: { in: orders.map((order) => order.id) } },
  });

  await createAuditLog({
    actorId: result.user.id,
    action: "SPADMIN_DELETE_ORDERS",
    targetType: "ORDER",
    details: {
      orderIds: orders.map((order) => order.id),
      statuses: orders.map((order) => ({ id: order.id, status: order.status })),
      count: orders.length,
    },
  });

  revalidatePath("/admin/orders");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");

  return NextResponse.json({ success: true, deleted: orders.length });
}