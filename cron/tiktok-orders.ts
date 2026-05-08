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

          // Deduct 500 VND if first time success
          if (!session.hasPaid) {
            await prisma.$transaction(async (tx) => {
              const sessionUpdateResult = await tx.tiktokSession.updateMany({
                where: { id: session.id, hasPaid: false },
                data: { hasPaid: true }
              });
              
              if (sessionUpdateResult.count === 0) {
                return;
              }

              const updateResult = await tx.user.updateMany({
                where: { id: session.userId, balance: { gte: 500 } },
                data: { balance: { decrement: 500 } }
              });
              
              if (updateResult.count === 0) {
                throw new Error(`Session ${session.id}: Số dư người dùng không đủ 500đ để đồng bộ TikTok.`);
              }
              
              await tx.transaction.create({
                data: {
                  userId: session.userId,
                  amount: -500,
                  type: "TIKTOK_SYNC_FEE",
                  note: `[TikTok] Phí tra cứu đơn hàng lần đầu session: ${session.session}`
                }
              });
            });
            session.hasPaid = true; // Update local memory
          }

          for (const order of listData.orders) {
            // Kiểm tra trạng thái trong DB để bỏ qua các đơn đã hoàn thành/đã giao
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
                console.log(`[TikTokWorker] Bỏ qua đơn ${order.order_id} vì đã ở trạng thái: ${existingOrder.status}`);
                continue;
              }
            }

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
            
            if (detailData?.detail?.logistics?.message) {
                statusTranslated = detailData.detail.logistics.message;
            }

            let orderTs: Date | undefined;
            const ts = detailData?.detail?.create_time || order?.create_time;
            if (ts) {
                orderTs = new Date(typeof ts === 'number' ? (ts < 1e12 ? ts * 1000 : ts) : ts);
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
                ...(orderTs ? { createdAt: orderTs } : {}),
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
                ...(orderTs ? { createdAt: orderTs } : {}),
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
