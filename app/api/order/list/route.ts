import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";

export async function GET() {
  const result = await requireApiUser();

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const orders = await prisma.order.findMany({
    where: { userId: result.user.id },
    orderBy: { createdAt: "desc" },
  });

  const adminIds = [
    ...new Set(
      orders
        .map((o) => o.approvedByAdminId)
        .filter((v): v is number => typeof v === "number")
    ),
  ];

  const admins = adminIds.length
    ? await prisma.user.findMany({
        where: { id: { in: adminIds } },
        select: { id: true, username: true, fullName: true },
      })
    : [];

  const adminMap = new Map(admins.map((a) => [a.id, a]));

  const ordersWithAdmin = orders.map((o) => ({
    ...o,
    approvedByAdmin: o.approvedByAdminId ? (adminMap.get(o.approvedByAdminId) ?? null) : null,
  }));

  return NextResponse.json({ orders: ordersWithAdmin });
}
