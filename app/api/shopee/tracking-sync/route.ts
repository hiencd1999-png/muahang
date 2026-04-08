import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

    return NextResponse.json({ tracking: results });
  } catch (error) {
    console.error("Shopee tracking error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Failed to fetch Shopee tracking" 
    }, { status: 500 });
  }
}
