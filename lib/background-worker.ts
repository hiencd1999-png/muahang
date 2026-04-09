import { prisma } from "@/lib/prisma";
import { ShopeeTrackingChecker } from "@/lib/shopee-tracking";
import { OrderStatus } from "@prisma/client";

const RUN_INTERVAL_MS = 5 * 60 * 1000;
const GROUP_SIZE = 100;

let isRunning = false;

async function syncGroup(orders: any[], proxies: any[]) {
    // Chạy tuần tự trong nhóm 100 đơn
    for (const order of orders) {
        let proxyConf = undefined;
        if (proxies.length > 0) {
            const p = proxies[Math.floor(Math.random() * proxies.length)];
            proxyConf = { host: p.host, port: p.port, username: p.username, password: p.password };
        }

        try {
            const checker = new ShopeeTrackingChecker(order.spcCookie!, proxyConf);
            const results = await checker.run(15, 0);

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
                if (uniqueTrackings.length > 0) newTrackingNo = uniqueTrackings.join("\n");

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
                        prisma.order.update({ where: { id: order.id }, data: updates }),
                        prisma.user.update({ where: { id: order.approvedByAdminId }, data: { balance: { increment: commission } } }),
                        prisma.transaction.create({ data: { userId: order.approvedByAdminId, amount: commission, type: "ADMIN_ADJUSTMENT", note: `Hoa hồng xử lý đơn giao thành công #${order.id} (95% của ${order.total.toLocaleString("vi-VN")}đ)` } }),
                        prisma.notification.create({ data: { userId: order.approvedByAdminId, type: "BALANCE_CHANGED", title: "Hoa hồng hoàn thành đơn", message: `Bạn được cộng ${commission.toLocaleString("vi-VN")}đ từ đơn #${order.id}.`, link: `/admin/orders?orderId=${order.id}` } })
                    ]);
                } else if (updates.status === "CANCELED" && order.status !== "CANCELED" && order.status !== "DELIVERED") {
                    await prisma.$transaction([
                        prisma.order.update({ where: { id: order.id }, data: updates }),
                        prisma.user.update({ where: { id: order.userId }, data: { balance: { increment: order.total } } }),
                        prisma.transaction.create({ data: { userId: order.userId, amount: order.total, type: "ORDER_REFUND", note: `Hoàn tiền tự động vì API Tracking Shopee trả về Đã huỷ - Order #${order.id}` } }),
                        prisma.notification.create({ data: { userId: order.userId, type: "ORDER_CANCELED", title: "Đơn hàng bị huỷ bởi Shopee", message: `Đơn #${order.id} của bạn vừa bị huỷ trên Shopee. Hệ thống đã hoàn trả ${order.total.toLocaleString("vi-VN")}đ vào ví của bạn.`, link: `/dashboard/orders?orderId=${order.id}` } })
                    ]);
                } else {
                    await prisma.order.update({ where: { id: order.id }, data: updates });
                }
                console.log(`📦 [AutoSyncWorker] Đơn #${order.id}: ${order.status} -> ${newStatus}. ${updates.status === 'DELIVERED' ? '💰 CỘNG TIỀN CHO ADMIN!' : updates.status === 'CANCELED' ? '🔄 ĐÃ HOÀN TIỀN CHO USER!' : ''}`);
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Error";
            if (msg.includes("expired") || msg.includes("rejected cookie")) {
                await prisma.order.update({ where: { id: order.id }, data: { spcCookie: "" } });
                console.log(`⚠️ [AutoSyncWorker] Đơn #${order.id}: Cookie đã chết. Đã tự động xoá.`);
            }
        }
    }
}

export async function runBackgroundCron() {
    if (isRunning) return;
    isRunning = true;
    
    try {
        // --- 1. AUTO-CANCEL: Huỷ đơn quá hạn 6 tiếng nếu user đã chỉ định định danh Admin mà Admin không duyệt ---
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        const expiredOrders = await prisma.order.findMany({
            where: {
                status: "PENDING",
                approvedByAdminId: { not: null },
                createdAt: { lt: sixHoursAgo }
            }
        });

        for (const expOrder of expiredOrders) {
            await prisma.$transaction([
                // Đẩy trạng thái về CANCELED
                prisma.order.update({
                    where: { id: expOrder.id },
                    data: {
                        status: "CANCELED",
                        cancelReason: "Hệ thống huỷ tự động: Admin phụ trách không lên kịp đơn sau 6 tiếng",
                    }
                }),
                // Hoàn lại tiền cho User
                prisma.user.update({
                    where: { id: expOrder.userId },
                    data: { balance: { increment: expOrder.total } }
                }),
                // Ghi log hoàn tiền
                prisma.transaction.create({
                    data: {
                        userId: expOrder.userId,
                        amount: expOrder.total,
                        type: "ORDER_REFUND",
                        note: `Hoàn tiền: Admin đánh trễ đơn #${expOrder.id} quá 6 tiếng`
                    }
                }),
                // Báo cho User biết
                prisma.notification.create({
                    data: {
                        userId: expOrder.userId,
                        type: "ORDER_CANCELED",
                        title: "Đơn hàng bị huỷ tự động",
                        message: `Đơn #${expOrder.id} của bạn bị huỷ (Hoàn ${expOrder.total.toLocaleString("vi-VN")}đ) do Admin phụ trách hẹn không lên kịp đơn trong 6 tiếng.`,
                        link: "/dashboard/orders"
                    }
                })
            ]);
            console.log(`[AutoSyncWorker] Đã tự động HUỶ đơn #${expOrder.id} vì Admin được chỉ định ngâm quá 6 tiếng.`);
        }

        // --- 2. THEO DÕI MÃ VẬN ĐƠN NGẦM ---
        const orders = await prisma.order.findMany({
            where: {
                status: { notIn: ["DELIVERED", "CANCELED"] },
                spcCookie: { not: "" }
            }
        });

        if (orders.length > 0) {
            console.log(`\n🤖 [AutoSyncWorker] Tìm thấy ${orders.length} đơn có mã vận đơn. Sẽ chia vào CÁC NHÓM ${GROUP_SIZE} ĐƠN...`);
            const proxies = await prisma.systemProxy.findMany({ where: { isActive: true } });

            // Chia làm các nhóm 100
            for (let i = 0; i < orders.length; i += GROUP_SIZE) {
                const group = orders.slice(i, i + GROUP_SIZE);
                console.log(`=> Đang xử lý Nhóm ${Math.floor(i/GROUP_SIZE) + 1}/${Math.ceil(orders.length/GROUP_SIZE)} (Chứa ${group.length} đơn)...`);
                await syncGroup(group, proxies);
            }
            console.log(`🤖 [AutoSyncWorker] Xử lý thành công hoàn tất đợt đồng bộ.\n`);
        }
    } catch (err) {
        console.error("🔥 [AutoSyncWorker] Lỗi database:", err);
    } finally {
        isRunning = false;
    }
}

const globalAny: any = global;
export function bootWorker() {
    if (!globalAny.__backgroundWorkerStarted) {
        globalAny.__backgroundWorkerStarted = true;
        console.log("🛠️ Datdon: Khởi chạy bộ quét tự động (Auto-Sync) 5 phút một lần cùng Server.");
        
        setInterval(runBackgroundCron, RUN_INTERVAL_MS);
        
        // Quét ngay lần đầu sau 10 giây tính từ khi boot server
        setTimeout(runBackgroundCron, 10000); 
    }
}
