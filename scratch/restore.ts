import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Tìm các đơn bị HỦY nhầm
    const canceledOrders = await prisma.order.findMany({
        where: { status: 'CANCELED' },
    });

    let countCanceled = 0;
    for (const order of canceledOrders) {
        if (!order.shopeeTrackingData) continue;
        try {
            const results = JSON.parse(order.shopeeTrackingData);
            if (!Array.isArray(results) || results.length === 0) continue;

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

            if (!isCanceled) {
                console.log(`[CANCELED] Order ${order.id} should NOT be canceled. Restoring...`);
                await prisma.$transaction(async (tx) => {
                    await tx.order.update({
                        where: { id: order.id },
                        data: { status: 'TRACKING_GENERATED' }
                    });
                    
                    await tx.user.update({
                        where: { id: order.userId },
                        data: { balance: { decrement: order.total } }
                    });

                    await tx.transaction.create({
                        data: {
                            userId: order.userId,
                            amount: -order.total,
                            type: 'ADMIN_ADJUSTMENT', 
                            note: `Trừ tiền hoàn nhầm do khôi phục đơn #${order.id} bị báo hủy nhầm`
                        }
                    });
                });
                countCanceled++;
            }
        } catch (e) {
            console.error(`Error on canceled order ${order.id}:`, e);
        }
    }

    // Tìm các đơn bị ĐÃ GIAO nhầm
    const deliveredOrders = await prisma.order.findMany({
        where: { status: 'DELIVERED', approvedByAdminId: { not: null } },
    });

    let countDelivered = 0;
    for (const order of deliveredOrders) {
        if (!order.shopeeTrackingData) continue;
        try {
            const results = JSON.parse(order.shopeeTrackingData);
            if (!Array.isArray(results) || results.length === 0) continue;

            const isDelivered = results.some((r: any) => {
                const check = (desc: string) => {
                  const d = (desc || "").toLowerCase();
                  if (d === "đã giao hàng" || d === "hoàn thành" || d === "đơn hàng hoàn thành") return true;
                  
                  if (d.includes("giao hàng thành công")) {
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

            if (!isDelivered && order.approvedByAdminId) {
                console.log(`[DELIVERED] Order ${order.id} should NOT be delivered. Restoring...`);
                await prisma.$transaction(async (tx) => {
                    await tx.order.update({
                        where: { id: order.id },
                        data: { status: 'TRACKING_GENERATED' }
                    });
                    
                    const commission = Math.floor(order.total * 0.95);
                    await tx.user.update({
                        where: { id: order.approvedByAdminId! },
                        data: { balance: { decrement: commission } }
                    });

                    await tx.transaction.create({
                        data: {
                            userId: order.approvedByAdminId!,
                            amount: -commission,
                            type: 'ADMIN_ADJUSTMENT', 
                            note: `Trừ hoa hồng do khôi phục đơn #${order.id} bị báo giao thành công nhầm`
                        }
                    });
                });
                countDelivered++;
            }
        } catch (e) {
            console.error(`Error on delivered order ${order.id}:`, e);
        }
    }

    console.log(`Restored ${countCanceled} canceled orders!`);
    console.log(`Restored ${countDelivered} delivered orders!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
