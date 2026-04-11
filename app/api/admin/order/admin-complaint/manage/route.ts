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

  if (!order || !order.complaintStatus || order.complaintStatus !== "PENDING" || order.status !== "CANCELED") {
    return NextResponse.json({ error: "Không tìm thấy yêu cầu khiếu nại phạt hợp lệ." }, { status: 404 });
  }

  if (action === "REJECT") {
    const updateResult = await prisma.order.updateMany({
      where: { id: orderId, complaintStatus: "PENDING" },
      data: { complaintStatus: "REJECTED" },
    });

    if (updateResult.count === 0) {
      return NextResponse.json({ error: "Khiếu nại này đã được xử lý bởi người khác." }, { status: 409 });
    }

    if (order.approvedByAdminId) {
      await createNotification(
        order.approvedByAdminId,
        "ADMIN_MESSAGE",
        "Khiếu nại phạt Khách bị từ chối",
        `Khiếu nại khách cố tình không nhận hàng (đơn #${order.id}) đã bị SPADMIN từ chối.`,
        `/admin/orders?orderId=${order.id}`
      );
    }

    await createAuditLog({
      actorId: result.user.id,
      action: "SPADMIN_REJECT_ADMIN_COMPLAINT",
      targetType: "ORDER",
      targetId: order.id,
      details: { reason: order.complaintReason }
    });

    return NextResponse.json({ success: true, message: "Đã từ chối khiếu nại của Admin." });
  }

  // APPROVED: Deduct user 50%, Give Admin 50%.
  const penaltyAmount = Math.floor(order.total * 0.5);

  try {
    await prisma.$transaction(async (tx) => {
      const updateResult = await tx.order.updateMany({
        where: { id: orderId, complaintStatus: "PENDING" },
        data: { complaintStatus: "APPROVED" },
      });

      if (updateResult.count === 0) {
        throw new Error("ALREADY_PROCESSED");
      }
      
      // Trừ 50% tiền User
      await tx.user.update({
        where: { id: order.userId },
        data: { balance: { decrement: penaltyAmount } },
      });
      await tx.transaction.create({
        data: {
          userId: order.userId,
          amount: -penaltyAmount,
          type: "ADMIN_ADJUSTMENT",
          note: `Phạt 50% giá trị đơn hàng (không nhận hàng cố ý) cho đơn #${order.id}`,
        },
      });

      if (order.approvedByAdminId) {
        await tx.user.update({
          where: { id: order.approvedByAdminId },
          data: { balance: { increment: penaltyAmount } },
        });
        await tx.transaction.create({
          data: {
            userId: order.approvedByAdminId,
            amount: penaltyAmount,
            type: "ADMIN_ADJUSTMENT",
            note: `Đền bù 50% tiền đơn #${order.id} khách không nhận hàng`,
          },
        });
      }
    });
  } catch (err: any) {
    if (err.message === "ALREADY_PROCESSED") {
      return NextResponse.json({ error: "Khiếu nại này đã được xử lý bởi người khác." }, { status: 400 });
    }
    return NextResponse.json({ error: "Lỗi hệ thống khi xử lý khiếu nại." }, { status: 500 });
  }

  // Notify User
  await createNotification(
    order.userId,
    "BALANCE_CHANGED",
    "Trừ tiền vi phạm đơn hàng",
    `Bạn bị trừ ${penaltyAmount}đ (50% giá trị) do khiếu nại cố tình không nhận hàng tại đơn #${order.id}.`,
    `/dashboard/orders?orderId=${order.id}`
  );

  // Notify Admin
  if (order.approvedByAdminId) {
    await createNotification(
      order.approvedByAdminId,
      "BALANCE_CHANGED",
      "Khiếu nại Khách thành công",
      `Bạn được cộng ${penaltyAmount}đ đền bù từ đơn #${order.id} bị hủy.`,
      `/admin/orders?orderId=${order.id}`
    );
  }

  await createAuditLog({
    actorId: result.user.id,
    action: "SPADMIN_APPROVE_ADMIN_COMPLAINT",
    targetType: "ORDER",
    targetId: order.id,
    details: { reason: order.complaintReason }
  });

  return NextResponse.json({ success: true, message: "Đã duyệt phạt khách và đền bù cho Admin." });
}
