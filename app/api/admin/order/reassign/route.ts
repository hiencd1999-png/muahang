import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { releaseExpiredProcessingOrders } from "@/lib/order-assignment";

const schema = z.object({
  orderId: z.number().int().positive(),
  adminId: z.number().int().positive(),
});

export async function PATCH(request: Request) {
  const result = await requireApiUser("SPADMIN");

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu đổi admin phụ trách không hợp lệ." }, { status: 400 });
  }

  await releaseExpiredProcessingOrders();

  const [order, nextAdmin] = await Promise.all([
    prisma.order.findUnique({ where: { id: parsed.data.orderId } }),
    prisma.user.findFirst({
      where: {
        id: parsed.data.adminId,
        role: { in: ["ADMIN", "SPADMIN"] },
      },
      select: { id: true, username: true, fullName: true, role: true },
    }),
  ]);

  if (!order) {
    return NextResponse.json({ error: "Đơn hàng không tồn tại." }, { status: 404 });
  }

  if (!nextAdmin) {
    return NextResponse.json({ error: "Admin phụ trách mới không hợp lệ." }, { status: 400 });
  }

  const previousAdminId = order.approvedByAdminId;

  if (previousAdminId === nextAdmin.id) {
    return NextResponse.json({ success: true });
  }

  const isPendingOrder = order.status === "PENDING";
  const isProcessingOrder = order.status === "PROCESSING";

  await prisma.order.update({
    where: { id: order.id },
    data: {
      approvedByAdminId: nextAdmin.id,
      status: isPendingOrder ? "PROCESSING" : order.status,
      processingStartedAt: isPendingOrder || isProcessingOrder ? new Date() : null,
    },
  });

  await createAuditLog({
    actorId: result.user.id,
    action: "SPADMIN_REASSIGN_ORDER_OWNER",
    targetType: "ORDER",
    targetId: order.id,
    details: {
      previousAdminId,
      nextAdminId: nextAdmin.id,
      previousStatus: order.status,
      nextStatus: isPendingOrder ? "PROCESSING" : order.status,
    },
  });

  revalidatePath("/admin/orders");
  revalidatePath("/dashboard/orders");

  return NextResponse.json({ success: true });
}