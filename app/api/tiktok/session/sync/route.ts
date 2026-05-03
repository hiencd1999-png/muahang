import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { sessionId } = await request.json();

    const session = await prisma.tiktokSession.findFirst({
      where: { id: Number(sessionId), userId: auth.user.id },
    });

    if (!session) {
      return NextResponse.json({ error: "Session không tồn tại" }, { status: 404 });
    }

    const proxies = await prisma.systemProxy.findMany({ where: { isActive: true } });
    if (proxies.length === 0) {
      return NextResponse.json({ error: "Hệ thống đang hết proxy" }, { status: 500 });
    }

    const proxy = proxies[Math.floor(Math.random() * proxies.length)];
    const proxyStr = `${proxy.host}:${proxy.port}:${proxy.username}:${proxy.password}`;

    const listUrl = `https://vubel-tiktok.vercel.app/api/order/list?session=${session.session}&proxy=${proxyStr}&limit=10`;
    const listRes = await fetch(listUrl);
    const listData = await listRes.json();

    if (listData.ok && listData.orders) {
      // Deduct 200 VND if first time
      if (!session.hasPaid) {
        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: session.userId },
            data: { balance: { decrement: 200 } }
          });
          await tx.transaction.create({
            data: {
              userId: session.userId,
              amount: 200,
              type: "ORDER_DEBIT",
              note: `[TikTok] Phí tra cứu đơn hàng lần đầu session: ${session.session}`
            }
          });
          await tx.tiktokSession.update({
            where: { id: session.id },
            data: { hasPaid: true }
          });
        });
      }

      for (const order of listData.orders) {
        const detailUrl = `https://vubel-tiktok.vercel.app/api/order/detail?session=${session.session}&proxy=${proxyStr}&order_id=${order.order_id}`;
        let detailData = null;
        try {
          const detailRes = await fetch(detailUrl);
          detailData = await detailRes.json();
        } catch (err) {}

        let trackingNo = "";
        let phone = "";
        let address = "";
        
        if (detailData?.detail) {
            trackingNo = detailData.detail.logistics?.tracking_no || "";
            phone = detailData.detail.recipient?.phone || "";
            address = detailData.detail.recipient?.address || "";
        }

        let statusTranslated = order.status;
        if (order.status === "Canceled") statusTranslated = "Đã hủy";
        else if (order.status === "In transit") statusTranslated = "Đang giao";
        else if (order.status === "Order delivered") statusTranslated = "Đã giao";
        else if (order.status === "Order completed") statusTranslated = "Đã hoàn thành";

        await prisma.tiktokOrder.upsert({
          where: { orderId: order.order_id },
          update: {
            shopId: order.shop_id,
            shopName: order.shop_name,
            status: statusTranslated,
            total: order.total,
            trackingNo,
            phone,
            address,
            products: order.products,
            details: detailData,
          },
          create: {
            sessionId: session.id,
            orderId: order.order_id,
            shopId: order.shop_id,
            shopName: order.shop_name,
            status: statusTranslated,
            total: order.total,
            trackingNo,
            phone,
            address,
            products: order.products,
            details: detailData,
          }
        });
      }

      await prisma.tiktokSession.update({
        where: { id: session.id },
        data: { lastRunAt: new Date(), isActive: true }
      });

      return NextResponse.json({ success: true });
    } else {
      await prisma.tiktokSession.update({
        where: { id: session.id },
        data: { isActive: false, lastRunAt: new Date() }
      });
      return NextResponse.json({ error: "Session không hợp lệ hoặc lỗi API" }, { status: 400 });
    }

  } catch (error) {
    console.error("Error syncing TikTok session:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
