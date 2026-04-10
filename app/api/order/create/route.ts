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
  productLink: z.string().trim().min(1).max(2000),
  resolvedLink: z.string().trim().max(2000).optional(),
  productName: z.string().trim().min(1).max(300),
  shopId: z.string().trim().min(1).max(50),
  variant: z.string().trim().min(1).max(300),
  quantity: z.number().int().min(1).max(100).optional(),
};

const sharedShape = {
  voucherCode: z.string().trim().min(2).max(60),
  quantity: z.number().int().min(1).max(100).optional(),
  phone: z.string().trim().min(1).max(50).optional(),
  address: z.string().trim().min(8).max(800),
  ward: z.string().trim().min(1, "Vui lòng phân tích địa chỉ trước khi tạo đơn").max(100),
  note: z.string().trim().max(2000).optional(),
  requestedAdminId: z.number().int().optional(),
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
  ward: string;
  note?: string;
  items: Array<z.infer<typeof batchItemSchema> & { quantity: number }>;
  requestedAdminId?: number;
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
      requestedAdminId: batchParsed.data.requestedAdminId
    };
  }

  const legacyParsed = legacySchema.safeParse(body);
  if (!legacyParsed.success) {
    return null;
  }

  const { productLink, resolvedLink, productName, shopId, variant, voucherCode, quantity, phone, address, ward, note } = legacyParsed.data;

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
    ward,
    note,
    requestedAdminId: legacyParsed.data.requestedAdminId
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

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const pendingInWard = await prisma.order.count({
      where: {
        address: { contains: parsed.ward },
        createdAt: { gte: twentyFourHoursAgo },
        status: { in: ["PENDING", "PROCESSING", "ORDER_PLACED"] },
        OR: [
          { trackingNo: null },
          { trackingNo: "" }
        ]
      }
    });

    if (pendingInWard >= 15) {
       return NextResponse.json({ 
         error: `Khu vực "${parsed.ward}" đang có ${pendingInWard} đơn trong 24h chưa có mã vận đơn. Tạm thời không thể tạo thêm đơn ở khu vực này.` 
       }, { status: 400 });
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
    
    // Combine product names
    const rawMergedProductName = preparedItems.map(item => item.productName.trim()).join(" + ");
    const mergedProductName = rawMergedProductName.length > 300 
      ? rawMergedProductName.substring(0, 300) + '...' 
      : rawMergedProductName;

    const newOrder = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: result.user.id },
        data: { balance: { decrement: total } },
      });

      const order = await tx.order.create({
        data: {
          userId: result.user.id,
          productLink: primaryItem.canonicalProductLink,
          productName: mergedProductName,
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
          approvedByAdminId: parsed.requestedAdminId || null,
        },
      });

      const orderNoteParts = [
        `Tạo đơn: ${mergedProductName.substring(0, 60)}${mergedProductName.length > 60 ? '...' : ''}`,
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
      `Bạn vừa tạo đơn hàng với số tiền ${(total / 1000).toFixed(0)}k`,
      "/dashboard/orders"
    );

    const { broadcastToAdmins } = await import("@/lib/telegram");
    
    const reqUrl = new URL(request.url);
    const adminOrderLink = `${reqUrl.origin}/admin/orders?orderId=${newOrder.id}&action=view`;

    await broadcastToAdmins(
        `📦 *Có đơn hàng mới!*\n- Mã đơn: #${newOrder.id}\n- Sản phẩm: ${mergedProductName}\n- Khách hàng: ${result.user.username}\n- Địa chỉ: ${parsed.address}\n- Link Mua Nháp: ${primaryItem.canonicalProductLink}\n- Tổng phí: ${(total).toLocaleString('vi-VN')} đ\n- *🔗 Mở chi tiết:* [Click để xem và Nhận đơn](${adminOrderLink})`, 
        "ADMIN_ORDER"
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
