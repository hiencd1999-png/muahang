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
  const forceRaw = request.nextUrl.searchParams.get("force");
  const isForceParams = forceRaw === "true";
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

    // SMART POLLING (Exponential Backoff): Tránh spam Proxy Shopee
    const msSinceLastUpdate = Date.now() - order.updatedAt.getTime();

    if (!isForceParams) {
      // 1. Nếu đang Đi đường (TRACKING_GENERATED): Rất lâu mới giao tới, giãn cách 6 Tiếng/lần quét
      if (order.status === "TRACKING_GENERATED" && msSinceLastUpdate < 6 * 60 * 60 * 1000) {
          let cached = [];
          try { if (order.shopeeTrackingData) cached = JSON.parse(order.shopeeTrackingData); } catch {}
          return NextResponse.json({ tracking: cached, autoUpdatedStatus: order.status, cachedResponse: true, msg: "Delayed backoff" });
      }

      // 2. Nếu vừa Đặt Đơn (ORDER_PLACED): Chờ tối thiểu 10 Phút mới rà soát
      if (order.status === "ORDER_PLACED" && msSinceLastUpdate < 10 * 60 * 1000) {
          let cached = [];
          try { if (order.shopeeTrackingData) cached = JSON.parse(order.shopeeTrackingData); } catch {}
          return NextResponse.json({ tracking: cached, autoUpdatedStatus: order.status, cachedResponse: true, msg: "10-min cooling" });
      }
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
    
    // Cưỡng chế đẩy mốc updatedAt để chốt mốc thời gian cho vòng Smart Polling kế tiếp
    updates.updatedAt = new Date();

    const anyDeliveringSoon = results.some((r: any) => 
      (r.description || "").includes("Đơn hàng sẽ sớm được giao, vui lòng chú ý điện thoại")
    );
    let oldDeliveringSoon = false;
    try {
      if (order.shopeeTrackingData) {
        const oldResults = JSON.parse(order.shopeeTrackingData);
        oldDeliveringSoon = oldResults.some((r: any) => 
          (r.description || "").includes("Đơn hàng sẽ sớm được giao, vui lòng chú ý điện thoại")
        );
      }
    } catch {}

    if (anyDeliveringSoon && !oldDeliveringSoon) {
       const { sendTelegramNotification } = await import("@/lib/telegram");
       await sendTelegramNotification(
          order.userId,
          `🚚 *Đơn Hàng Tới Nơi*\nĐơn hàng #${order.id} sẽ sớm được giao. Vui lòng chú ý điện thoại và chuẩn bị quay video khi nhận hàng bạn nhé!`,
          "USER_ORDER"
       ).catch(() => {});
    }

    if (Object.keys(updates).length > 0) {
      if (updates.status === "DELIVERED" && order.approvedByAdminId) {
        const commission = Math.floor(order.total * 0.95);
        try {
          await prisma.$transaction(async (tx) => {
            const updateResult = await tx.order.updateMany({
              where: { id: orderId, status: order.status },
              data: updates,
            });

            if (updateResult.count === 0) throw new Error("ConcurrencyError");

            await tx.user.update({
              where: { id: order.approvedByAdminId! },
              data: { balance: { increment: commission } },
            });
            await tx.transaction.create({
              data: {
                userId: order.approvedByAdminId!,
                amount: commission,
                type: "ADMIN_ADJUSTMENT",
                note: `Hoa hồng xử lý đơn giao thành công #${order.id} (95% của ${order.total.toLocaleString("vi-VN")}đ)`,
              },
            });
            await tx.notification.create({
              data: {
                userId: order.approvedByAdminId!,
                type: "BALANCE_CHANGED",
                title: "Hoa hồng hoàn thành đơn",
                message: `Bạn được cộng ${commission.toLocaleString("vi-VN")}đ từ đơn #${order.id}.`,
                link: `/admin/orders?orderId=${order.id}`,
              },
            });
          });
        } catch (error: any) {
           if (error.message !== "ConcurrencyError") throw error;
        }
      } else if (updates.status === "CANCELED") {
        try {
          await prisma.$transaction(async (tx) => {
            const updateResult = await tx.order.updateMany({
              where: { id: orderId, status: order.status },
              data: updates,
            });

            if (updateResult.count === 0) throw new Error("ConcurrencyError");

            await tx.user.update({
               where: { id: order.userId },
               data: { balance: { increment: order.total } } 
            });
            await tx.transaction.create({
              data: { 
                userId: order.userId, 
                amount: order.total, 
                type: "ORDER_REFUND", 
                note: `Hoàn tiền tự động vì API Tracking hiển thị Đã Huỷ - Order #${order.id}` 
              }
            });
            await tx.notification.create({
              data: { 
                userId: order.userId, 
                type: "ORDER_CANCELED", 
                title: "Đơn hàng bị huỷ bởi Shopee", 
                message: `Đơn #${order.id} của bạn vừa bị huỷ trên Shopee. Hệ thống đã hoàn trả ${order.total.toLocaleString("vi-VN")}đ vào ví của bạn.`, 
                link: `/dashboard/orders?orderId=${order.id}` 
              }
            });
          });
        } catch (error: any) {
           if (error.message !== "ConcurrencyError") throw error;
        }
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
