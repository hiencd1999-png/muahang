import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";

const schema = z.object({
  orderId: z.number().int().positive(),
  action: z.enum(["APPROVE", "REJECT"]),
});

export async function POST(request: NextRequest) {
  const result = await requireApiUser("SPADMIN");
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload không hợp lệ." }, { status: 400 });
  }

  const { orderId, action } = parsed.data;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order || !order.complaintStatus || order.complaintStatus !== "PENDING") {
    return NextResponse.json({ error: "Không tìm thấy yêu cầu khiếu nại hợp lệ." }, { status: 404 });
  }

  if (action === "REJECT") {
    await prisma.order.update({
      where: { id: orderId },
      data: { complaintStatus: "REJECTED" },
    });
    
    // Báo cho User
    await createNotification(
      order.userId,
      "ADMIN_MESSAGE",
      "Khiếu nại bị từ chối",
      `Khiếu nại đơn #${order.id} của bạn đã bị từ chối bởi Ban quản trị.`,
      `/dashboard/orders?orderId=${order.id}`
    );

    await createAuditLog({
      actorId: result.user.id,
      action: "SPADMIN_REJECT_COMPLAINT",
      targetType: "ORDER",
      targetId: order.id,
      details: { reason: order.complaintReason }
    });

    return NextResponse.json({ success: true, message: "Đã từ chối khiếu nại." });
  }

  // Nếu Approve: Hoàn tiền User, Trừ hoa hồng Admin phụ trách
  const commission = Math.floor(order.total * 0.95);

  const txs: any[] = [
    prisma.order.update({
      where: { id: orderId },
      data: { complaintStatus: "APPROVED" },
    }),
    
    // Hoàn tiền User
    prisma.user.update({
      where: { id: order.userId },
      data: { balance: { increment: order.total } },
    }),
    prisma.transaction.create({
      data: {
        userId: order.userId,
        amount: order.total,
        type: "ORDER_REFUND",
        note: `Hoàn tiền do khiếu nại thành công đơn #${order.id}`,
      },
    }),
  ];

  if (order.approvedByAdminId) {
    // Trừ commission của Admin chuyên trách
    txs.push(
      prisma.user.update({
        where: { id: order.approvedByAdminId },
        data: { balance: { decrement: commission } },
      }),
      prisma.transaction.create({
        data: {
          userId: order.approvedByAdminId,
          amount: -commission,
          type: "ADMIN_ADJUSTMENT",
          note: `Trừ tiền do đơn #${order.id} bị khiếu nại và hoàn tiền (95% của ${order.total})`,
        },
      })
    );
  }

  await prisma.$transaction(txs);

  // Notifications
  await createNotification(
    order.userId,
    "BALANCE_CHANGED",
    "Khiếu nại thành công",
    `Khiếu nại đơn #${order.id} của bạn đã được chấp thuận. Hoàn trả ${order.total}đ.`,
    `/dashboard/orders?orderId=${order.id}`
  );

  if (order.approvedByAdminId) {
    await createNotification(
      order.approvedByAdminId,
      "BALANCE_CHANGED",
      "Bị trừ phí khiếu nại",
      `Đơn #${order.id} do bạn phụ trách bị user khiếu nại thành công. Hệ thống thu hồi ${commission}đ hoa hồng.`,
      `/admin/orders?orderId=${order.id}`
    );
  }

  await createAuditLog({
    actorId: result.user.id,
    action: "SPADMIN_APPROVE_COMPLAINT",
    targetType: "ORDER",
    targetId: order.id,
    details: { reason: order.complaintReason }
  });

  return NextResponse.json({ success: true, message: "Đã duyệt khiếu nại và hoàn tiền/thu hồi phí." });
}
