import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";
import { requireApiUser } from "@/lib/session";
import { ShopeeTrackingChecker } from "@/lib/shopee-tracking";

export async function GET(request: NextRequest) {
  const result = await requireApiUser();
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const orderIdRaw = request.nextUrl.searchParams.get("orderId");
  const orderId = Number(orderIdRaw);
  if (!orderId || isNaN(orderId)) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.userId !== result.user.id && result.user.role === "USER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!order.spcCookie) {
      return NextResponse.json({ tracking: [] });
    }

    if (order.status === "DELIVERED" || order.status === "CANCELED") {
      let cached = [];
      try {
        if (order.shopeeTrackingData) cached = JSON.parse(order.shopeeTrackingData);
      } catch (e) {}
      return NextResponse.json({ tracking: cached, autoUpdatedStatus: order.status });
    }

    // Pick a random proxy
    const proxies = await prisma.systemProxy.findMany({
      where: { isActive: true },
    });

    let proxyConf = undefined;
    if (proxies.length > 0) {
      const p = proxies[Math.floor(Math.random() * proxies.length)];
      proxyConf = {
        host: p.host,
        port: p.port,
        username: p.username,
        password: p.password,
      };
    }

    const checker = new ShopeeTrackingChecker(order.spcCookie, proxyConf);
    const results = await checker.run(15, 0); // Limit 15 to get enough history if many orders placed

    let newStatus: OrderStatus = order.status;
    let newTrackingNo = order.trackingNo || "";

    if (results.length > 0) {
      const anyDelivered = results.some((r: any) => 
        r.description === "Đã giao hàng" || 
        r.description === "Hoàn thành" || 
        r.description === "Giao hàng thành công"
      );
      const allCanceled = results.every((r: any) => 
        r.description === "Đã hủy" || 
        r.description === "Hủy bởi hệ thống" ||
        r.description === "Đã huỷ"
      );

      const allTrackingNumbers = results
        .map((r: any) => (r.tracking_number || "").trim())
        .filter(Boolean);
      const uniqueTrackings = Array.from(new Set(allTrackingNumbers));

      if (uniqueTrackings.length > 0) {
        newTrackingNo = uniqueTrackings.join("\n");
      }

      if (anyDelivered) {
        newStatus = "DELIVERED";
      } else if (allCanceled) {
        newStatus = "CANCELED";
      } else if (newTrackingNo && (newStatus === "PENDING" || newStatus === "PROCESSING" || newStatus === "ORDER_PLACED")) {
        newStatus = "TRACKING_GENERATED";
      }
    }

    const stringifiedResults = JSON.stringify(results);
    const updates: any = {};
    if (order.shopeeTrackingData !== stringifiedResults) updates.shopeeTrackingData = stringifiedResults;
    if (order.status !== newStatus) updates.status = newStatus;
    if (order.trackingNo !== newTrackingNo) updates.trackingNo = newTrackingNo;

    if (Object.keys(updates).length > 0) {
      if (updates.status === "DELIVERED" && order.approvedByAdminId) {
        const commission = Math.floor(order.total * 0.95);
        await prisma.$transaction([
          prisma.order.update({
            where: { id: orderId },
            data: updates,
          }),
          prisma.user.update({
            where: { id: order.approvedByAdminId },
            data: { balance: { increment: commission } },
          }),
          prisma.transaction.create({
            data: {
              userId: order.approvedByAdminId,
              amount: commission,
              type: "ADMIN_ADJUSTMENT",
              note: `Hoa hồng xử lý đơn giao thành công #${order.id} (95% của ${order.total.toLocaleString("vi-VN")}đ)`,
            },
          }),
          prisma.notification.create({
            data: {
              userId: order.approvedByAdminId,
              type: "BALANCE_CHANGED",
              title: "Hoa hồng hoàn thành đơn",
              message: `Bạn được cộng ${commission.toLocaleString("vi-VN")}đ từ đơn #${order.id}.`,
              link: `/admin/orders?orderId=${order.id}`,
            },
          }),
        ]);
      } else {
        await prisma.order.update({
          where: { id: orderId },
          data: updates,
        });
      }
    }

    return NextResponse.json({ tracking: results, autoUpdatedStatus: newStatus });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error";
    console.error("Shopee tracking error:", msg);
    
    if (msg.includes("SPC_ST expired") || msg.includes("Shopee rejected cookie")) {
      await prisma.order.update({
        where: { id: orderId },
        data: { spcCookie: "" }
      });
      return NextResponse.json({ 
        error: "Cookie bị lỗi hoặc hết hạn, đã tự động xóa. Hệ thống dừng theo dõi." 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      error: msg 
    }, { status: 500 });
  }
}
