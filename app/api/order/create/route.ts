import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildCanonicalShopeeLink, calculateOrderTotal, isValidShopeeLink, parseShopeeProductLink } from "@/lib/order";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { createNotification } from "@/lib/notifications";

const schema = z.object({
  productLink: z.string().trim().min(1),
  resolvedLink: z.string().trim().optional(),
  productName: z.string().trim().min(1),
  shopId: z.string().trim().min(1),
  quantity: z.number().int().min(1).max(100),
  phone: z.string().trim().min(1).optional(),
  address: z.string().trim().min(8),
  variant: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

export async function POST(request: Request) {
  const result = await requireApiUser();

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu đơn hàng không hợp lệ." }, { status: 400 });
  }

  if (!isValidShopeeLink(parsed.data.productLink)) {
    return NextResponse.json({ error: 'Link sản phẩm phải chứa "shopee".' }, { status: 400 });
  }

  const linkCandidate = (parsed.data.resolvedLink || parsed.data.productLink).trim();
  const parsedLink = parseShopeeProductLink(linkCandidate);
  const canonicalProductLink = parsedLink.shopId && parsedLink.itemId
    ? buildCanonicalShopeeLink(parsedLink.shopId, parsedLink.itemId)
    : linkCandidate;

  const total = calculateOrderTotal(parsed.data.quantity);

  if (result.user.balance < total) {
    return NextResponse.json({ error: "Số dư không đủ để tạo đơn." }, { status: 400 });
  }

  const orderNoteParts = ["Create order debit"];
  if (parsed.data.variant) {
    orderNoteParts.push(`Variant: ${parsed.data.variant}`);
  }
  if (parsed.data.note) {
    orderNoteParts.push(`Note: ${parsed.data.note}`);
  }

  const newOrder = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: result.user.id },
      data: { balance: { decrement: total } },
    });

    const order = await tx.order.create({
      data: {
        userId: result.user.id,
        productLink: canonicalProductLink,
        productName: parsed.data.productName,
        shopId: parsed.data.shopId,
        variant: parsed.data.variant,
        quantity: parsed.data.quantity,
        phone: parsed.data.phone?.trim() || "Không cung cấp",
        address: parsed.data.address,
        note: parsed.data.note,
        total,
        status: "PENDING",
      },
    });

    await tx.transaction.create({
      data: {
        userId: result.user.id,
        amount: -total,
        type: "ORDER_DEBIT",
        note: orderNoteParts.join(" | "),
      },
    });

    return order;
  });

  await createNotification(
    result.user.id,
    "ORDER_CREATED",
    `Đơn hàng #${newOrder.id} được tạo`,
    `Bạn vừa tạo một đơn hàng mới với số tiền ${(total / 1000).toFixed(0)}k`,
    `/dashboard/orders`
  );

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/create-order");
  revalidatePath("/admin/orders");

  return NextResponse.json({ success: true, total });
}
