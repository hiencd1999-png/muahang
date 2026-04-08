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

  const normalizedCodes = parsed.data.configs.map((config) => config.code.trim().toUpperCase());
  if (new Set(normalizedCodes).size !== normalizedCodes.length) {
    return NextResponse.json({ error: "Mã voucher bị trùng." }, { status: 400 });
  }

  await ensureVoucherPricingConfigs();

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