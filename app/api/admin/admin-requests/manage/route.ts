import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
   requestId: z.number().int(),
   action: z.enum(["APPROVE", "REJECT"])
});

export async function POST(req: Request) {
   try {
       const result = await requireApiUser("SPADMIN");
       if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

       const body = await req.json();
       const data = schema.parse(body);

       const adminReq = await prisma.adminRequest.findUnique({
           where: { id: data.requestId },
           include: { user: true }
       });

       if (!adminReq || adminReq.status !== "PENDING") {
           return NextResponse.json({ error: "Yêu cầu không tồn tại hoặc đã được xử lý." }, { status: 400 });
       }

       if (data.action === "APPROVE") {
           await prisma.$transaction([
               prisma.adminRequest.update({
                   where: { id: adminReq.id },
                   data: { status: "APPROVED" }
               }),
               prisma.user.update({
                   where: { id: adminReq.userId },
                   data: { role: "ADMIN" }
               })
           ]);
       } else {
           await prisma.adminRequest.update({
               where: { id: adminReq.id },
               data: { status: "REJECTED" }
           });
       }

       return NextResponse.json({ success: true });
   } catch (error: any) {
       return NextResponse.json({ error: "Lỗi nội bộ: " + error.message }, { status: 500 });
   }
}
