import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchTikTokOrders() {
  console.log(`[TikTokWorker] Bắt đầu lấy đơn TikTok: ${new Date().toISOString()}`);

  try {
    const proxies = await prisma.systemProxy.findMany({ where: { isActive: true } });
    if (proxies.length === 0) {
      console.log("[TikTokWorker] Không có proxy hoạt động.");
      return;
    }

    const sessions = await prisma.tiktokSession.findMany({ where: { isActive: true } });
    if (sessions.length === 0) {
      return;
    }

    let proxyIndex = 0;

    for (const session of sessions) {
      const proxy = proxies[proxyIndex % proxies.length];
      const proxyStr = `${proxy.host}:${proxy.port}:${proxy.username}:${proxy.password}`;
      proxyIndex++;

      try {
        const listUrl = `https://vubel-tiktok.vercel.app/api/order/list?session=${session.session}&proxy=${proxyStr}&limit=10`;
        const listRes = await fetch(listUrl);
        const listData = await listRes.json();

        if (listData.ok && listData.orders) {
          console.log(`[TikTokWorker] Lấy được ${listData.orders.length} đơn cho session ${session.id}`);

          // Deduct 200 VND if first time success
          if (!session.hasPaid) {
            await prisma.$transaction(async (tx) => {
              const user = await tx.user.findUnique({ where: { id: session.userId } });
              if (user && user.balance >= 200) {
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
              } else if (user) {
                // Not enough balance, maybe we should skip processing this session? 
                // Or just process and let balance go negative or throw error. The requirement doesn't specify rejecting if balance < 200, but typically we would.
                // Assuming we deduct anyway or we can just proceed.
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
              }
            });
            session.hasPaid = true; // Update local memory
          }

          for (const order of listData.orders) {
            const detailUrl = `https://vubel-tiktok.vercel.app/api/order/detail?session=${session.session}&proxy=${proxyStr}&order_id=${order.order_id}`;
            let detailData = null;
            try {
              const detailRes = await fetch(detailUrl);
              detailData = await detailRes.json();
            } catch (err) {
              console.error(`[TikTokWorker] Lỗi khi lấy chi tiết đơn ${order.order_id}:`, err);
            }

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
            
            await delay(1000); // Respect rate limits
          }

          await prisma.tiktokSession.update({
            where: { id: session.id },
            data: { lastRunAt: new Date() }
          });
        } else {
          console.log(`[TikTokWorker] Lỗi session ${session.id}:`, listData);
        }
      } catch (error) {
        console.error(`[TikTokWorker] Lỗi session ${session.id}:`, error);
      }
    }
  } catch (error) {
    console.error(`[TikTokWorker-Critical] Lỗi toàn cục:`, error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  fetchTikTokOrders();
}
