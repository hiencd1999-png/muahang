import { NextResponse } from "next/server";
import { z } from "zod";
import { VoucherType } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { ensureVoucherPricingConfigs } from "@/lib/voucher-store";

const updateVoucherPricingSchema = z.object({
  configs: z.array(
    z.object({
      voucherType: z.nativeEnum(VoucherType),
      unitPrice: z.number().int().min(0).max(10_000_000),
      isMaintenance: z.boolean(),
    })
  ).min(1),
});

export async function GET() {
  const result = await requireApiUser("SPADMIN");

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const configs = await ensureVoucherPricingConfigs();
  return NextResponse.json({ configs });
}

export async function PATCH(request: Request) {
  const result = await requireApiUser("SPADMIN");

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const body = await request.json();
  const parsed = updateVoucherPricingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu cấu hình voucher không hợp lệ." }, { status: 400 });
  }

  await ensureVoucherPricingConfigs();

  await prisma.$transaction(
    parsed.data.configs.map((config) =>
      prisma.voucherPricing.update({
        where: { voucherType: config.voucherType },
        data: {
          unitPrice: config.unitPrice,
          isMaintenance: config.isMaintenance,
        },
      })
    )
  );

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