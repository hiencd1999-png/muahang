import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";

const schema = z.object({
  orderId: z.number().int().positive(),
  reason: z.string().trim().min(5, "Lý do quá ngắn.").max(500, "Lý do quá dài."),
});

export async function POST(request: NextRequest) {
  const result = await requireApiUser("ADMIN");
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || "Lý do không hợp lệ";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { orderId, reason } = parsed.data;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    return NextResponse.json({ error: "Đơn hàng không tồn tại." }, { status: 404 });
  }

  if (order.status !== "CANCELED") {
    return NextResponse.json({ error: "Chỉ có thể khiếu nại đơn đã bị Hủy." }, { status: 400 });
  }

  if (order.complaintStatus) {
    return NextResponse.json({ error: "Đơn này đã được khiếu nại rồi." }, { status: 400 });
  }

  if (order.approvedByAdminId !== null && order.approvedByAdminId !== result.user.id && result.user.role !== "SPADMIN") {
    return NextResponse.json({ error: "Chỉ admin xử lý đơn này mới được khiếu nại." }, { status: 403 });
  }

  const updateResult = await prisma.order.updateMany({
    where: { id: order.id, complaintStatus: null },
    data: {
      complaintReason: reason,
      complaintStatus: "PENDING",
      complaintAt: new Date(),
    },
  });

  if (updateResult.count === 0) {
    return NextResponse.json({ error: "Đơn này đã được xử lý hoặc được định trạng thái khác." }, { status: 409 });
  }

  await createAuditLog({
    actorId: result.user.id,
    action: "ADMIN_CREATE_COMPLAINT",
    targetType: "ORDER",
    targetId: order.id,
    details: { reason },
  });

  const { broadcastToAdmins } = await import("@/lib/telegram");
  const adminOrderLink = `${process.env.NEXT_PUBLIC_APP_URL || "https://datdon.otistx.com"}/admin/orders?orderId=${order.id}&action=view`;

  await broadcastToAdmins(
    `🚨 *Admin Khiếu nại Đơn Hủy!*\n- Lệnh: #${order.id}\n- Khách hàng không nhận hàng.\n- Lý do: ${reason}\n- *🔗 Mở chi tiết để duyệt:* [Click](${adminOrderLink})`,
    "ADMIN_ORDER"
  );

  return NextResponse.json({ success: true });
}
