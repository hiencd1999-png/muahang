import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/session";
import { fetchShopeeProductDetails } from "@/lib/shopee";

const schema = z.object({
  productLink: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request) {
  const result = await requireApiUser();
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Yêu cầu phân tích sản phẩm không hợp lệ." }, { status: 400 });
  }

  try {
    const details = await fetchShopeeProductDetails(parsed.data.productLink);
    return NextResponse.json(details);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể lấy dữ liệu từ Shopee." }, { status: 400 });
  }
}
