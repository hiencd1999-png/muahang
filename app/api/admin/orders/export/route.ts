import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { buildOrdersWorkbookBuffer } from "@/lib/excel";
import { createAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  const result = await requireApiUser("ADMIN");

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { orderIds } = await request.json();

  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return NextResponse.json({ error: "Vui lòng chọn đơn hàng để xuất Excel." }, { status: 400 });
  }

  const orders = await prisma.order.findMany({
    where: {
      id: { in: orderIds.map(Number).filter(Number.isFinite) },
    },
    include: {
      user: {
        select: { username: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (orders.length === 0) {
    return NextResponse.json({ error: "Không tìm thấy đơn hàng phù hợp để xuất." }, { status: 404 });
  }

  await createAuditLog({
    actorId: result.user.id,
    action: "ADMIN_EXPORT_ORDERS_EXCEL",
    targetType: "ORDER",
    details: { orderIds: orders.map((order) => order.id), count: orders.length },
  });

  const buffer = buildOrdersWorkbookBuffer(
    orders.map((order) => ({
      id: order.id,
      username: order.user.username,
      productName: order.productName,
      productLink: order.productLink,
      shopId: order.shopId,
      variant: order.variant,
      phone: order.phone,
      address: order.address,
      note: order.note,
      quantity: order.quantity,
      total: order.total,
      status: order.status,
      cancelReason: order.cancelReason,
      spcCookie: order.spcCookie,
      trackingNo: order.trackingNo,
      createdAt: order.createdAt,
    })),
    { includeDetailFields: true, includeNoteField: true, includeAdminFields: true }
  );

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="admin-orders-${Date.now()}.xlsx"`,
    },
  });
}
