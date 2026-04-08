import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function POST(request: NextRequest) {
  const admin = await requireUser("ADMIN");

  const { userIds, amountChange } = await request.json();

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: "userIds is required" }, { status: 400 });
  }

  if (typeof amountChange !== "number" || amountChange === 0) {
    return NextResponse.json({ error: "amountChange must be non-zero number" }, { status: 400 });
  }

  try {
    const results = await Promise.all(
      userIds.map(async (userId: number) => {
        const user = await prisma.user.update({
          where: { id: userId },
          data: { balance: { increment: amountChange } },
        });

        // Create transaction record
        await prisma.transaction.create({
          data: {
            userId,
            amount: amountChange,
            type: "ADMIN_ADJUSTMENT",
            note: `Admin điều chỉnh số dư: ${amountChange > 0 ? "+" : ""}${amountChange}`,
          },
        });

        return user;
      })
    );

    // Log the action
    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        action: "BULK_ADJUST_BALANCE",
        targetType: "USER",
        targetId: 0,
        details: JSON.stringify({
          userIds,
          amountChange,
          count: results.length,
        }),
      },
    });

    return NextResponse.json({
      message: `Updated balance for ${results.length} users`,
      updated: results.length,
    });
  } catch (error) {
    console.error("Batch balance update error:", error);
    return NextResponse.json({ error: "Failed to update balances" }, { status: 500 });
  }
}
