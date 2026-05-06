import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Để cấu hình cron trên Vercel, thêm đoạn sau vào vercel.json ở thư mục gốc:
// {
//   "crons": [
//     {
//       "path": "/api/cron/tiktok-sync",
//       "schedule": "*/5 * * * *"
//     }
//   ]
// }

export async function GET(request: Request) {
  // Lấy secret key từ url để bảo mật, tránh bị người lạ gọi API
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  
  // Nếu bạn cấu hình Vercel Cron, nó sẽ tự động pass header bảo mật. 
  // Ở đây ta bypass tạm hoặc bạn có thể cấu hình CRON_SECRET trong .env
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const activeSessions = await prisma.tiktokSession.findMany({
      where: { isActive: true },
    });

    if (activeSessions.length === 0) {
      return NextResponse.json({ success: true, message: "Không có session hoạt động để đồng bộ" });
    }

    const proxies = await prisma.systemProxy.findMany({ where: { isActive: true } });
    if (proxies.length === 0) {
      return NextResponse.json({ error: "Hệ thống đang hết proxy" }, { status: 500 });
    }

    let successCount = 0;
    let failedCount = 0;

    for (const session of activeSessions) {
      const proxy = proxies[Math.floor(Math.random() * proxies.length)];
      const proxyStr = `${proxy.host}:${proxy.port}:${proxy.username}:${proxy.password}`;

      try {
        const listUrl = `https://vubel-tiktok.vercel.app/api/order/list?session=${session.session}&proxy=${proxyStr}&limit=10`;
        const listRes = await fetch(listUrl);
        const listData = await listRes.json();

        if (listData.ok && listData.orders) {
          // Trừ tiền lần đầu 500đ
          if (!session.hasPaid) {
            await prisma.$transaction(async (tx) => {
              await tx.user.update({
                where: { id: session.userId },
                data: { balance: { decrement: 500 } }
              });
              await tx.transaction.create({
                data: {
                  userId: session.userId,
                  amount: -500,
                  type: "TIKTOK_SYNC_FEE",
                  note: `[Auto Cron] Phí tra cứu đơn hàng lần đầu session: ${session.session}`
                }
              });
              await tx.tiktokSession.update({
                where: { id: session.id },
                data: { hasPaid: true }
              });
            });
          }

          for (const order of listData.orders) {
            // Check order status
            const existingOrder = await prisma.tiktokOrder.findUnique({
              where: { orderId: order.order_id },
              select: { status: true }
            });

            if (existingOrder && existingOrder.status) {
              const currentStatus = existingOrder.status.toLowerCase();
              if (
                currentStatus.includes("đã được giao") ||
                currentStatus === "đã giao" ||
                currentStatus === "đã hoàn thành" ||
                currentStatus === "đã hủy"
              ) {
                continue;
              }
            }

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
            
            if (detailData?.detail?.logistics?.message) {
                statusTranslated = detailData.detail.logistics.message;
            }

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
          successCount++;
        } else {
          // Session die hoặc lỗi
          await prisma.tiktokSession.update({
            where: { id: session.id },
            data: { isActive: false, lastRunAt: new Date() }
          });
          failedCount++;
        }
      } catch (err) {
        failedCount++;
      }
    }

    return NextResponse.json({ 
        success: true, 
        message: `Đã chạy ngầm xong. Thành công: ${successCount}, Lỗi/Die: ${failedCount}` 
    });

  } catch (error) {
    console.error("Cron Job Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
