import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { ensureVoucherPricingConfigs } from "@/lib/voucher-store";

const updateVoucherPricingSchema = z.object({
  configs: z.array(
    z.object({
      code: z.string().trim().min(2).max(60).regex(/^[A-Za-z0-9_\-]+$/),
      label: z.string().trim().min(2).max(120),
      unitPrice: z.number().int().min(0).max(10_000_000),
      isMaintenance: z.boolean(),
    })
  ).min(1),
});

export async function GET() {
  const result = await requireApiUser("ADMIN");

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  let configs = await ensureVoucherPricingConfigs();

  if (result.user.role !== "SPADMIN") {
    const dbUser = await prisma.user.findUnique({
      where: { id: result.user.id },
      select: { disabledVouchers: true },
    });
    const disabledVouchers = dbUser?.disabledVouchers || [];

    configs = configs.map(c => ({
      ...c,
      // Hiển thị bảo trì nếu hệ thống đang bảo trì VÀ/HOẶC admin đó tự tắt nhận đơn
      isMaintenance: c.isMaintenance || disabledVouchers.includes(c.code),
    }));
  }

  return NextResponse.json({ configs });
}

export async function PATCH(request: Request) {
  const result = await requireApiUser("ADMIN");

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const isSpAdmin = result.user.role === "SPADMIN";

  const body = await request.json();
  const parsed = updateVoucherPricingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu cấu hình voucher không hợp lệ." }, { status: 400 });
  }

  const normalizedCodes = parsed.data.configs.map((config) => config.code.trim().toUpperCase());
  if (new Set(normalizedCodes).size !== normalizedCodes.length) {
    return NextResponse.json({ error: "Mã voucher bị trùng." }, { status: 400 });
  }

  const existingConfigs = await ensureVoucherPricingConfigs();

  if (!isSpAdmin) {
    const incomingCodesSet = new Set(normalizedCodes);
    const existingCodes = existingConfigs.map(c => c.code);
    
    // Đảm bảo không chỉnh sửa linh tinh
    if (incomingCodesSet.size !== existingCodes.length || !existingCodes.every(c => incomingCodesSet.has(c))) {
      return NextResponse.json({ error: "Bạn không có quyền Thêm hoặc Xóa các cấu hình nhận đơn." }, { status: 403 });
    }

    const disabledVouchers: string[] = [];
    
    for (const config of parsed.data.configs) {
      const existing = existingConfigs.find(c => c.code === config.code);
      if (
        !existing || 
        existing.label !== config.label || 
        existing.unitPrice !== config.unitPrice
      ) {
        return NextResponse.json({ error: "Bạn chỉ có thể Bật/Tắt nhận đơn, không được sửa tên hoặc giá." }, { status: 403 });
      }
      if (config.isMaintenance) {
        disabledVouchers.push(config.code);
      }
    }

    // Save personal toggle preference
    await prisma.user.update({
      where: { id: result.user.id },
      data: { disabledVouchers }
    });

    await createAuditLog({
      actorId: result.user.id,
      action: "ADMIN_UPDATE_VOUCHER_PREFERENCE",
      targetType: "USER",
      details: { disabledVouchers },
    });

    const customizedConfigs = existingConfigs.map(c => ({
      ...c,
      isMaintenance: c.isMaintenance || disabledVouchers.includes(c.code)
    }));

    return NextResponse.json({ success: true, configs: customizedConfigs });
  }

  // LƯU Ý: Phần dưới này chỉ chạy khi isSpAdmin === true
  await prisma.$transaction(async (tx) => {
    const incomingCodes = parsed.data.configs.map((config) => config.code);

    await tx.voucherPricing.deleteMany({
      where: {
        code: {
          notIn: incomingCodes,
        },
      },
    });

    await Promise.all(
      parsed.data.configs.map((config) =>
        tx.voucherPricing.upsert({
          where: { code: config.code },
          update: {
            label: config.label,
            unitPrice: config.unitPrice,
            isMaintenance: config.isMaintenance,
          },
          create: {
            code: config.code,
            label: config.label,
            unitPrice: config.unitPrice,
            isMaintenance: config.isMaintenance,
          },
        })
      )
    );
  });

  await createAuditLog({
    actorId: result.user.id,
    action: "SPADMIN_UPDATE_VOUCHER_PRICING",
    targetType: "VOUCHER_PRICING",
    details: {
      configs: parsed.data.configs,
    },
  });

  const configs = await ensureVoucherPricingConfigs();
  return NextResponse.json({ success: true, configs });
}