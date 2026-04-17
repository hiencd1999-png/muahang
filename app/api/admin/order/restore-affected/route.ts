import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { isSpAdminRole } from "@/lib/roles";

export async function POST(request: Request) {
  const result = await requireApiUser("ADMIN");
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  
  if (!isSpAdminRole(result.user.role)) {
    return NextResponse.json({ error: "Chỉ SPADMIN mới được thực thi kịch bản khôi phục này." }, { status: 403 });
  }

  try {
    const canceledOrders = await prisma.order.findMany({ where: { status: 'CANCELED' } });
    let countCanceled = 0;
    
    for (const order of canceledOrders) {
        if (!order.shopeeTrackingData) continue;
        const results = JSON.parse(order.shopeeTrackingData);
        if (!Array.isArray(results) || results.length === 0) continue;

        const isCanceled = results.every((r: any) => {
            const check = (desc: string) => {
                const d = (desc || "").toLowerCase();
                return d.includes("đã hủy") || d.includes("đã huỷ") || d.includes("hủy bởi hệ thống") ||
                       d.includes("huỷ bởi hệ thống") || d.includes("bị hủy") || d.includes("bị huỷ") || d.includes("đơn vị vận chuyển thông báo đơn hàng đã bị");
            };
            if (check(r.description)) return true;
            if (r.logistics?.shipping_status && check(r.logistics.shipping_status)) return true;
            if (r.logistics?.history && Array.isArray(r.logistics.history)) {
               if (r.logistics.history.some((h: any) => check(h.description))) return true;
            }
            return false;
        });

        if (!isCanceled) {
            await prisma.$transaction(async (tx) => {
                await tx.order.update({ where: { id: order.id }, data: { status: 'TRACKING_GENERATED' } });
                await tx.user.update({ where: { id: order.userId }, data: { balance: { decrement: order.total } } });
                await tx.transaction.create({
                    data: {
                        userId: order.userId, amount: -order.total, type: 'ADMIN_ADJUSTMENT', 
                        note: `Trừ tiền hoàn nhầm do khôi phục đơn #${order.id} bị báo hủy nhầm`
                    }
                });
            });
            countCanceled++;
        }
    }

    const deliveredOrders = await prisma.order.findMany({ where: { status: 'DELIVERED', approvedByAdminId: { not: null } } });
    let countDelivered = 0;

    for (const order of deliveredOrders) {
        if (!order.shopeeTrackingData || !order.approvedByAdminId) continue;
        const results = JSON.parse(order.shopeeTrackingData);
        if (!Array.isArray(results) || results.length === 0) continue;

        const isDelivered = results.some((r: any) => {
            const check = (desc: string) => {
              const d = (desc || "").toLowerCase();
              if (d === "hoàn thành" || d === "đơn hàng hoàn thành") return true;
              return (d.includes("giao hàng thành công") || d.includes("đã giao hàng")) && !d.includes("cho đơn vị") && !d.includes("cho bên vận chuyển");
            };
            if (check(r.description)) return true;
            if (r.logistics?.shipping_status && check(r.logistics.shipping_status)) return true;
            if (r.logistics?.history && Array.isArray(r.logistics.history)) {
               if (r.logistics.history.some((h: any) => check(h.description))) return true;
            }
            return false;
        });

        if (!isDelivered) {
            await prisma.$transaction(async (tx) => {
                await tx.order.update({ where: { id: order.id }, data: { status: 'TRACKING_GENERATED' } });
                const commission = Math.floor(order.total * 0.95);
                await tx.user.update({ where: { id: order.approvedByAdminId! }, data: { balance: { decrement: commission } } });
                await tx.transaction.create({
                    data: {
                        userId: order.approvedByAdminId!, amount: -commission, type: 'ADMIN_ADJUSTMENT', 
                        note: `Trừ hoa hồng do khôi phục đơn #${order.id} bị báo giao thành công nhầm`
                    }
                });
            });
            countDelivered++;
        }
    }

    return NextResponse.json({ success: true, restoredCanceled: countCanceled, restoredDelivered: countDelivered });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
