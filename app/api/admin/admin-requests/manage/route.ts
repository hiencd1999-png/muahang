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

           try {
               const { createNotification } = await import("@/lib/notifications");
               const { sendTelegramNotification } = await import("@/lib/telegram");
               await createNotification(
                   adminReq.userId,
                   "ADMIN_MESSAGE",
                   "Yêu cầu nâng cấp thành công!",
                   "Chúc mừng! Yêu cầu nâng cấp tài khoản của bạn đã được duyệt. Bạn chính thức là Học viên/CTV (Admin).",
                   "/dashboard"
               );
               await sendTelegramNotification(
                   adminReq.userId,
                   `🎉 *Nâng cấp Admin thành công*\nTuyệt vời! Yêu cầu nâng cấp tài khoản của bạn đã được Giám đốc (SPADMIN) phê duyệt.\n- Cấp bậc mới: Quản trị viên (Admin)\n- Hãy đăng xuất và đăng nhập lại để trải nghiệm các tính năng Admin nhé!`,
                   "USER_ORDER"
               );
           } catch(e) {}

       } else {
           await prisma.adminRequest.update({
               where: { id: adminReq.id },
               data: { status: "REJECTED" }
           });

           try {
               const { createNotification } = await import("@/lib/notifications");
               const { sendTelegramNotification } = await import("@/lib/telegram");
               await createNotification(
                   adminReq.userId,
                   "ADMIN_MESSAGE",
                   "Yêu cầu nâng cấp bị từ chối",
                   "Rất tiếc, yêu cầu nâng cấp lên Admin của bạn chưa thể được duyệt vào lúc này.",
                   "/dashboard"
               );
               await sendTelegramNotification(
                   adminReq.userId,
                   `❌ *Yêu cầu nâng cấp bị từ chối*\nRất tiếc, yêu cầu nâng cấp lên Admin của bạn đã bị từ chối.\nVui lòng liên hệ hỗ trợ nếu bạn cần thêm thông tin.`,
                   "USER_ORDER"
               );
           } catch(e) {}
       }

       return NextResponse.json({ success: true });
   } catch (error: any) {
       return NextResponse.json({ error: "Lỗi nội bộ: " + error.message }, { status: 500 });
   }
}
