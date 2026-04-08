import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { releaseExpiredProcessingOrders } from "@/lib/order-assignment";

export async function GET() {
  const result = await requireApiUser("ADMIN");

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await releaseExpiredProcessingOrders();

  const orders = await prisma.order.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orders });
}
