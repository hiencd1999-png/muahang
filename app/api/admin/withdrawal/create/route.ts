import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import z from "zod";

const schema = z.object({
  amount: z.number().int().min(10000, "Đơn vị tiền tối thiểu là 10.000 VNĐ"),
  walletAddress: z.string().min(5, "Ví không hợp lệ").max(200),
  network: z.enum(["TRC20", "BEP20", "ERC20", "BSC/BEP20"]).default("BSC/BEP20"),
}).superRefine((data, ctx) => {
  const isEvm = ["BEP20", "ERC20", "BSC/BEP20"].includes(data.network);
  if (isEvm && !/^0x[a-fA-F0-9]{40}$/.test(data.walletAddress)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Địa chỉ EVM (${data.network}) không hợp lệ (phải bắt đầu bằng 0x và dài 42 ký tự)`,
      path: ["walletAddress"]
    });
  } else if (data.network === "TRC20" && !/^T[A-Za-z1-9]{33}$/.test(data.walletAddress)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Địa chỉ TRC20 không hợp lệ (phải bắt đầu bằng T và dài 34 ký tự)",
      path: ["walletAddress"]
    });
  }
});


export async function POST(req: NextRequest) {
  try {
    const result = await requireApiUser("ADMIN");
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    const body = await req.json();
    const data = schema.parse(body);

    const user = result.user;

    // Lọc các request PENDING
    const pendingWithdrawals = await prisma.withdrawal.aggregate({
        where: { userId: user.id, status: "PENDING" },
        _sum: { amount: true }
    });
    
    const totalPending = pendingWithdrawals._sum.amount || 0;

    if (user.balance < totalPending + data.amount) {
        return NextResponse.json({ error: `Tài khoản bạn chỉ dư ${user.balance} VNĐ, tổng lệnh chờ: ${totalPending} VNĐ. Rút vượt quá số khả dụng.` }, { status: 400 });
    }

    const withdrawal = await prisma.withdrawal.create({
      data: {
        userId: user.id,
        amount: data.amount,
        walletAddress: data.walletAddress,
        network: data.network,
        status: "PENDING",
      },
    });

    return NextResponse.json(withdrawal);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
