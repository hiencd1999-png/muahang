import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/session";
import { analyzeShopeeAddress } from "@/lib/shopee-address";

const schema = z.object({
  address: z.string().trim().min(8),
  phone: z.string().trim().optional(),
  note: z.string().trim().optional(),
  spcCookie: z.string().trim().optional(),
});

export async function POST(request: Request) {
  const result = await requireApiUser();
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Yêu cầu phân tích địa chỉ không hợp lệ." }, { status: 400 });
  }

  try {
    const analyzed = await analyzeShopeeAddress(parsed.data);
    return NextResponse.json(analyzed);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể phân tích địa chỉ qua Shopee API." },
      { status: 400 }
    );
  }
}