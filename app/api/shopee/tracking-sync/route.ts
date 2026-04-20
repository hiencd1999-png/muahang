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

    // ONLINE HEALING: Fix wrong/fallback names from cached shopee tracking data right away before early-returns
    if (order.shopeeTrackingData) {
      try {
        const cached = JSON.parse(order.shopeeTrackingData);
        if (cached && cached.length > 0) {
           let matchedNames: string[] = [];
           const trackingsToMatch = (order.trackingNo || "").split("\n").map(t => t.trim()).filter(Boolean);
           if (trackingsToMatch.length > 0) {
               for (const t of trackingsToMatch) {
                   const matching = cached.find((r: any) => r.tracking_number && r.tracking_number === t && r.name && r.name.trim().length > 3);
                   if (matching && !matchedNames.includes(matching.name.trim())) {
                       matchedNames.push(matching.name.trim());
                   }
               }
           }
           if (matchedNames.length === 0) {
               const fallbackMatch = cached.find((r: any) => r.name && r.name.trim().length > 3);
               if (fallbackMatch) matchedNames.push(fallbackMatch.name.trim());
           }
           const foundName = matchedNames.join(" / ");
           // If the native name from Shopee differs from our current DB record (which might be fallback), upgrade it
           if (foundName && foundName !== order.productName) {
              await prisma.order.update({
                 where: { id: order.id },
                 data: { productName: foundName }
              });
              order.productName = foundName;
           }
        }
      } catch (e) {}
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
      const anyDelivered = results.some((r: any) => {
        const check = (desc: string) => {
          const d = (desc || "").toLowerCase();
          if (d === "đã giao hàng" || d === "hoàn thành" || d === "đơn hàng hoàn thành") return true;
          
          if (d.includes("giao hàng thành công")) {
             // Loại trừ các text lúc nhà bán hàng gửi đơn
             if (d.includes("cho đơn vị") || d.includes("cho bên vận chuyển") || d.includes("đã chuẩn bị hàng")) return false;
             return true;
          }
          if (d.includes("đã nhận được hàng")) return true;
          return false;
        };
        if (check(r.description)) return true;
        if (r.logistics?.shipping_status && check(r.logistics.shipping_status)) return true;
        if (r.logistics?.history && Array.isArray(r.logistics.history)) {
          if (r.logistics.history.some((h: any) => check(h.description))) return true;
        }
        return false;
      });

      const isCanceled = results.every((r: any) => {
        const check = (desc: string) => {
          const d = (desc || "").toLowerCase();
          return d.includes("đã hủy") || 
                 d.includes("đã huỷ") || 
                 d.includes("hủy bởi hệ thống") ||
                 d.includes("huỷ bởi hệ thống") ||
                 d.includes("bị hủy") ||
                 d.includes("bị huỷ") ||
                 d.includes("đơn vị vận chuyển thông báo đơn hàng đã bị");
        };
        if (check(r.description)) return true;
        if (r.logistics?.shipping_status && check(r.logistics.shipping_status)) return true;
        if (r.logistics?.history && Array.isArray(r.logistics.history)) {
          if (r.logistics.history.some((h: any) => check(h.description))) return true;
        }
        return false;
      });

      const allTrackingNumbers = results
        .map((r: any) => (r.tracking_number || "").trim())
        .filter(Boolean);
      const uniqueTrackings = Array.from(new Set(allTrackingNumbers));

      if (uniqueTrackings.length > 0) {
        newTrackingNo = uniqueTrackings.join("\n");
      }

      if (anyDelivered) {
        newStatus = "DELIVERED";
      } else if (isCanceled) {
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

    const checkDeliveringSoon = (desc: string) => {
        const d = (desc || "").toLowerCase();
        return d.includes("đơn hàng sẽ sớm được giao, vui lòng chú ý điện thoại") ||
               d.includes("đơn hàng chuẩn bị giao") ||
               d.includes("người mua có thể đến nhận hàng tại");
    };
    const hasDeliveringSoon = (resultsData: any[]) => {
       return resultsData.some((r: any) => {
          if (checkDeliveringSoon(r.description)) return true;
          if (r.logistics?.shipping_status && checkDeliveringSoon(r.logistics.shipping_status)) return true;
          if (r.logistics?.history && Array.isArray(r.logistics.history)) {
             if (r.logistics.history.some((h: any) => checkDeliveringSoon(h.description))) return true;
          }
          return false;
       });
    };

    const anyDeliveringSoon = hasDeliveringSoon(results);
    let oldDeliveringSoon = false;
    try {
      if (order.shopeeTrackingData) {
        const oldResults = JSON.parse(order.shopeeTrackingData);
        oldDeliveringSoon = hasDeliveringSoon(oldResults);
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

    let foundName = "";
    if (results && results.length > 0) {
       let matchedNames: string[] = [];
       const trackingsToMatch = (newTrackingNo || order.trackingNo || "").split("\n").map(t => t.trim()).filter(Boolean);
       
       if (trackingsToMatch.length > 0) {
           for (const t of trackingsToMatch) {
               const matching = results.find((r: any) => r.tracking_number && r.tracking_number === t && r.name && r.name.trim().length > 3);
               if (matching && !matchedNames.includes(matching.name.trim())) {
                   matchedNames.push(matching.name.trim());
               }
           }
       }

       if (matchedNames.length === 0) {
           const fallbackMatch = results.find((r: any) => r.name && r.name.trim().length > 3);
           if (fallbackMatch) matchedNames.push(fallbackMatch.name.trim());
       }
       foundName = matchedNames.join(" / ");
    }
    
    // Upgrade name if native Shopee name differs from our DB record
    if (foundName && foundName !== order.productName) {
       updates.productName = foundName;
    } else if (order.productName === "Sản phẩm Shopee" && order.productLink && order.spcCookie) {
      try {
        const { fetchShopeeProductDetails } = await import("@/lib/shopee");
        const details = await fetchShopeeProductDetails(order.productLink, order.spcCookie);
        if (details.productName && details.productName !== "Sản phẩm Shopee") {
           updates.productName = details.productName;
        }
      } catch (e) {}
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

      if (updates.status) {
         try {
             const { sendTelegramNotification } = await import("@/lib/telegram");
             let teleMsg = `📦 *Cập nhật vận chuyển*\nĐơn hàng #${order.id}\nTrạng thái gốc Shopee: ${updates.status}`;
             if (updates.status === 'DELIVERED') teleMsg = `🎉 *Đơn #${order.id} Giao Thành Công*\nShopee đã cập nhật giao hàng (Qua thao tác làm mới cục bộ)!`;
             if (updates.status === 'CANCELED') teleMsg = `🚫 *Đơn #${order.id} Đã Bị Hoàn/Hủy*\nHệ thống Shopee vừa chốt cập nhật HỦY. Hệ thống đã hoàn tiền.`;
             if (updates.status === 'TRACKING_GENERATED') teleMsg = `📦 *Đơn #${order.id} Có Mã Vận Đơn*\nShopee vừa gắn mã vận đơn mới cho đơn hàng!`;
             
             await sendTelegramNotification(order.userId, teleMsg, "USER_ORDER");
             if (order.approvedByAdminId) {
                 await sendTelegramNotification(order.approvedByAdminId, teleMsg, "ADMIN_ORDER");
             }
         } catch (e) {
             console.error("Tracking Sync Telegram notify error:", e);
         }
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
