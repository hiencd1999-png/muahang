import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildCanonicalShopeeLink, isValidShopeeLink, parseShopeeProductLink } from "@/lib/order";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { createNotification } from "@/lib/notifications";
import { ensureVoucherPricingConfigs } from "@/lib/voucher-store";
import { calculateVoucherOrderTotal } from "@/lib/voucher";

const schema = z.object({
  productLink: z.string().trim().min(1),
  resolvedLink: z.string().trim().optional(),
  productName: z.string().trim().min(1),
  shopId: z.string().trim().min(1),
  voucherCode: z.string().trim().min(2).max(60),
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

  const voucherConfigs = await ensureVoucherPricingConfigs();
  const selectedVoucher = voucherConfigs.find((voucher) => voucher.code === parsed.data.voucherCode);

  if (!selectedVoucher) {
    return NextResponse.json({ error: "Loại voucher không tồn tại." }, { status: 400 });
  }

  if (selectedVoucher.isMaintenance) {
    return NextResponse.json({ error: `Voucher ${selectedVoucher.label} đang bảo trì.` }, { status: 400 });
  }

  const total = calculateVoucherOrderTotal(selectedVoucher.unitPrice, parsed.data.quantity);

  if (result.user.balance < total) {
    return NextResponse.json({ error: "Số dư không đủ để tạo đơn." }, { status: 400 });
  }

  const orderNoteParts = ["Tạo đơn Shopee", `Voucher: ${selectedVoucher.label}`];
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
        voucherCode: selectedVoucher.code,
        voucherLabel: selectedVoucher.label,
        unitPrice: selectedVoucher.unitPrice,
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
    `Bạn vừa tạo đơn ${selectedVoucher.label} với số tiền ${(total / 1000).toFixed(0)}k`,
    `/dashboard/orders`
  );

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/create-order");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/vouchers");

  return NextResponse.json({ success: true, total });
}
