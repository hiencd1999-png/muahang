import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";

const schema = z.object({
  reason: z.string().trim().min(5, "Lý do quá ngắn.").max(500, "Lý do quá dài."),
});

export async function POST(
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
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || "Lý do không hợp lệ";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: result.user.id },
  });

  if (!order) {
    return NextResponse.json({ error: "Đơn hàng không tồn tại." }, { status: 404 });
  }

  if (order.status !== "DELIVERED") {
    return NextResponse.json({ error: "Chỉ có thể khiếu nại các đơn Đã Giao." }, { status: 400 });
  }

  if (order.complaintStatus) {
    return NextResponse.json({ error: "Đơn này đã được khiếu nại trước đó." }, { status: 400 });
  }

  // 3 days rule based on updatedAt when it was marked DELIVERED
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  if (order.updatedAt < threeDaysAgo) {
    return NextResponse.json({ error: "Chỉ được khiếu nại trong vòng 3 ngày sau khi giao." }, { status: 400 });
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      complaintReason: parsed.data.reason,
      complaintStatus: "PENDING",
      complaintAt: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}
