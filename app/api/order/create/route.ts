import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildCanonicalShopeeLink, isValidShopeeLink, parseShopeeProductLink } from "@/lib/order";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { createNotification } from "@/lib/notifications";
import { ensureVoucherPricingConfigs } from "@/lib/voucher-store";
import { calculateVoucherOrderTotal, type VoucherOption } from "@/lib/voucher";

const batchItemShape = {
  productLink: z.string().trim().min(1),
  resolvedLink: z.string().trim().optional(),
  productName: z.string().trim().min(1),
  shopId: z.string().trim().min(1),
  variant: z.string().trim().min(1),
  quantity: z.number().int().min(1).max(100).optional(),
};

const sharedShape = {
  voucherCode: z.string().trim().min(2).max(60),
  quantity: z.number().int().min(1).max(100).optional(),
  phone: z.string().trim().min(1).optional(),
  address: z.string().trim().min(8),
  note: z.string().trim().optional(),
};

const batchItemSchema = z.object(batchItemShape);
const batchSchema = z.object({
  ...sharedShape,
  items: z.array(batchItemSchema).min(1).max(100),
});

const legacySchema = z.object({
  ...sharedShape,
  productLink: z.string().trim().min(1),
  resolvedLink: z.string().trim().optional(),
  productName: z.string().trim().min(1),
  shopId: z.string().trim().min(1),
  variant: z.string().trim().min(1),
});

type NormalizedOrderRequest = {
  voucherCode: string;
  phone?: string;
  address: string;
  note?: string;
  items: Array<z.infer<typeof batchItemSchema> & { quantity: number }>;
};

type PreparedItem = {
  canonicalProductLink: string;
  productName: string;
  shopId: string;
  variant: string;
  quantity: number;
};

function normalizeOrderRequest(body: unknown): NormalizedOrderRequest | null {
  const batchParsed = batchSchema.safeParse(body);
  if (batchParsed.success) {
    const fallbackQuantity = batchParsed.data.quantity ?? 1;
    return {
      ...batchParsed.data,
      items: batchParsed.data.items.map((item) => ({
        ...item,
        quantity: item.quantity ?? fallbackQuantity,
      })),
    };
  }

  const legacyParsed = legacySchema.safeParse(body);
  if (!legacyParsed.success) {
    return null;
  }

  const { productLink, resolvedLink, productName, shopId, variant, voucherCode, quantity, phone, address, note } = legacyParsed.data;

  return {
    items: [
      {
        productLink,
        resolvedLink,
        productName,
        shopId,
        variant,
        quantity: quantity ?? 1,
      },
    ],
    voucherCode,
    phone,
    address,
    note,
  };
}

function mergeOrderNote(note: string | undefined, items: PreparedItem[]) {
  const parts: string[] = [];

  if (note?.trim()) {
    parts.push(note.trim());
  }

  if (items.length > 1) {
    const detailLines = items.map(
      (item, index) => `${index + 1}. ${item.canonicalProductLink} | Phân loại: ${item.variant} | SL: ${item.quantity}`
    );
    parts.push(`Chi tiết link:\n${detailLines.join("\n")}`);
  }

  if (parts.length === 0) {
    return undefined;
  }

  return parts.join("\n\n");
}

export async function POST(request: Request) {
  const result = await requireApiUser();

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const body = await request.json();
  const parsed = normalizeOrderRequest(body);

  if (!parsed) {
    return NextResponse.json({ error: "Dữ liệu đơn hàng không hợp lệ." }, { status: 400 });
  }

  try {
    const voucherConfigs = await ensureVoucherPricingConfigs();
    const selectedVoucher = voucherConfigs.find((voucher: VoucherOption) => voucher.code === parsed.voucherCode);

    if (!selectedVoucher) {
      return NextResponse.json({ error: "Loại voucher không tồn tại." }, { status: 400 });
    }

    if (selectedVoucher.isMaintenance) {
      return NextResponse.json({ error: `Voucher ${selectedVoucher.label} đang bảo trì.` }, { status: 400 });
    }

    const preparedItems = parsed.items.map((item, index) => {
      if (!isValidShopeeLink(item.productLink)) {
        throw new Error(`Link sản phẩm ở dòng ${index + 1} phải chứa \"shopee\".`);
      }

      const linkCandidate = (item.resolvedLink || item.productLink).trim();
      const parsedLink = parseShopeeProductLink(linkCandidate);
      const canonicalProductLink = parsedLink.shopId && parsedLink.itemId
        ? buildCanonicalShopeeLink(parsedLink.shopId, parsedLink.itemId)
        : linkCandidate;

      return {
        canonicalProductLink,
        productName: item.productName,
        shopId: item.shopId,
        variant: item.variant,
        quantity: item.quantity,
      };
    });

    const totalQuantity = preparedItems.reduce((sum, item) => sum + item.quantity, 0);
    // Tổng tiền chỉ tính giá của 1 đơn, không nhân số lượng
    const total = selectedVoucher.unitPrice;

    if (result.user.balance < total) {
      return NextResponse.json({ error: "Số dư không đủ để tạo đơn." }, { status: 400 });
    }

    const primaryItem = preparedItems[0];
    const mergedNote = mergeOrderNote(parsed.note, preparedItems);
    const mergedVariant = preparedItems.map((item, index) => `${index + 1}. ${item.variant} (SL ${item.quantity})`).join(" | ");

    const newOrder = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: result.user.id },
        data: { balance: { decrement: total } },
      });

      const order = await tx.order.create({
        data: {
          userId: result.user.id,
          productLink: primaryItem.canonicalProductLink,
          productName: preparedItems.length === 1 ? primaryItem.productName : `Đơn gộp ${preparedItems.length} link Shopee`,
          shopId: preparedItems.length === 1 ? primaryItem.shopId : null,
          variant: mergedVariant,
          quantity: totalQuantity,
          phone: parsed.phone?.trim() || "Không cung cấp",
          address: parsed.address,
          note: mergedNote,
          voucherCode: selectedVoucher.code,
          voucherLabel: selectedVoucher.label,
          unitPrice: selectedVoucher.unitPrice,
          total,
          status: "PENDING",
        },
      });

      const orderNoteParts = [
        "Tạo đơn Shopee",
        `Voucher: ${selectedVoucher.label}`,
        `Số link: ${preparedItems.length}`,
        `Tổng SL: ${totalQuantity}`,
      ];
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
      preparedItems.length === 1
        ? `Bạn vừa tạo đơn ${selectedVoucher.label} với số tiền ${(total / 1000).toFixed(0)}k`
        : `Bạn vừa tạo đơn gộp ${preparedItems.length} link với số tiền ${(total / 1000).toFixed(0)}k`,
      "/dashboard/orders"
    );

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard/create-order");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/vouchers");

    return NextResponse.json({
      success: true,
      total,
      createdCount: 1,
      orderIds: [newOrder.id],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tạo đơn thất bại.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
