import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { revalidatePath } from "next/cache";

const notesSchema = z.object({
  notes: z.string().min(1).max(500),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireApiUser("ADMIN");

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { id } = await params;
  const orderId = id ? parseInt(id) : null;
  const body = await request.json();
  const parsed = notesSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Ghi chú không hợp lệ." }, { status: 400 });
  }

  if (!orderId) {
    return NextResponse.json({ error: "Order ID không hợp lệ." }, { status: 400 });
  }

  // Log the admin's action
  await prisma.auditLog.create({
    data: {
      adminId: result.user.id,
      action: "UPDATE_ORDER_NOTES",
      targetType: "Order",
      targetId: orderId,
      details: JSON.stringify({ notes: parsed.data.notes.substring(0, 100) }),
    },
  });

  revalidatePath("/admin/orders");

  return NextResponse.json({ success: true });
}

