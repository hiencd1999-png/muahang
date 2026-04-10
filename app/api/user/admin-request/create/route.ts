import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const result = await requireApiUser();
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    const user = result.user;

    if (user.role !== "USER") {
       return NextResponse.json({ error: "Bạn đã là Admin hoặc cao hơn rồi." }, { status: 400 });
    }

    const pendingReq = await prisma.adminRequest.findFirst({
       where: { userId: user.id, status: "PENDING" }
    });

    if (pendingReq) {
       return NextResponse.json({ error: "Bạn đã được đệ trình một yêu cầu nâng cấp đang chờ duyệt." }, { status: 400 });
    }

    const deposit = await prisma.cryptoDeposit.findFirst({
        where: {
            userId: user.id,
            amount: { gte: 30 },
            status: "COMPLETED"
        }
    });

    if (!deposit) {
        return NextResponse.json({ 
            error: "Yêu cầu từ chối. Bạn cần có tối thiểu 1 lệnh nạp Crypto thành công từ 30 USDT trở lên để đủ điều kiện làm Admin." 
        }, { status: 400 });
    }

    const newReq = await prisma.adminRequest.create({
        data: {
            userId: user.id,
            status: "PENDING"
        }
    });

    return NextResponse.json({ success: true, request: newReq });
  } catch (error: any) {
    return NextResponse.json({ error: "Đã xảy ra lỗi: " + error.message }, { status: 500 });
  }
}
