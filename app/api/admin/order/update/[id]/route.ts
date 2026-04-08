import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";
import { isSpAdminRole } from "@/lib/roles";

const orderUpdateSchema = z.object({
  spcCookie: z.string().trim().max(4000).optional().or(z.literal("")),
  trackingNo: z.string().trim().max(120).optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireApiUser("ADMIN");

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { id } = await params;
  const orderId = id ? parseInt(id) : null;
  const body = await request.json();
  const parsed = orderUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Thông tin đơn hàng không hợp lệ." }, { status: 400 });
  }

  if (!orderId) {
    return NextResponse.json({ error: "Order ID không hợp lệ." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    return NextResponse.json({ error: "Đơn hàng không tồn tại." }, { status: 404 });
  }

  const canManageAllOrders = isSpAdminRole(result.user.role);
  const approvedByAdminId = (order as any).approvedByAdminId as number | null | undefined;

  if (!canManageAllOrders && approvedByAdminId && approvedByAdminId !== result.user.id) {
    return NextResponse.json(
      { error: "Bạn chỉ có thể chỉnh sửa các đơn do mình duyệt." },
      { status: 403 }
    );
  }

  if (!approvedByAdminId && order.status === "PENDING") {
    return NextResponse.json(
      { error: "Hãy duyệt đơn trước khi chỉnh sửa thông tin." },
      { status: 400 }
    );
  }

  const nextSpcCookie = parsed.data.spcCookie?.trim() || "";
  const nextTrackingNo = parsed.data.trackingNo?.trim() || "";
  const nextNote = parsed.data.note?.trim() || null;

  if (order.status === "DELIVERED") {
    const currentSpcCookie = order.spcCookie?.trim() || "";
    const currentTrackingNo = order.trackingNo?.trim() || "";

    if (nextSpcCookie !== currentSpcCookie || nextTrackingNo !== currentTrackingNo) {
      return NextResponse.json(
        { error: "Đơn đã giao chỉ được phép cập nhật ghi chú, không thể đổi SPC_ST hoặc mã vận đơn." },
        { status: 400 }
      );
    }
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      approvedByAdminId: approvedByAdminId ?? result.user.id,
      spcCookie: nextSpcCookie,
      trackingNo: nextTrackingNo,
      note: nextNote,
    },
  });

  await createAuditLog({
    actorId: result.user.id,
    action: "ADMIN_UPDATE_ORDER_LOGISTICS",
    targetType: "ORDER",
    targetId: orderId,
    details: {
      hasTrackingNo: Boolean(parsed.data.trackingNo?.trim()),
      hasSpcCookie: Boolean(parsed.data.spcCookie?.trim()),
      hasNote: Boolean(parsed.data.note?.trim()),
      deliveredOrder: order.status === "DELIVERED",
    },
  });

  revalidatePath("/admin/orders");
  revalidatePath("/dashboard/orders");

  return NextResponse.json({ success: true });
}

