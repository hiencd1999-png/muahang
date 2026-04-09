import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { authenticator } from "otplib";

export async function POST(req: Request) {
    const session = await requireApiUser();
    if ("error" in session) return NextResponse.json({ error: session.error }, { status: session.status });

    if (session.user.twoFactorEnabled) {
        return NextResponse.json({ error: "2FA đã được bật." }, { status: 400 });
    }

    try {
        const { token } = await req.json();

        const user = await prisma.user.findUnique({ where: { id: session.user.id } });
        if (!user?.twoFactorSecret) {
            return NextResponse.json({ error: "Vui lòng khởi tạo quy trình 2FA trước." }, { status: 400 });
        }

        authenticator.options = { window: 3 }; // Dung sai 3 chu kỳ (90 giây) hai chiều
        const cleanToken = String(token).replace(/\s+/g, '');
        const isValid = authenticator.verify({ token: cleanToken, secret: user.twoFactorSecret });
        if (!isValid) {
            return NextResponse.json({ error: "Mã OTP không hợp lệ, vui lòng thử lại." }, { status: 400 });
        }

        await prisma.user.update({
            where: { id: session.user.id },
            data: { twoFactorEnabled: true }
        });

        return NextResponse.json({ success: true, message: "Cài đặt 2FA thành công!" });
    } catch(e) {
        return NextResponse.json({ error: "Lỗi cấu hình 2FA" }, { status: 500 });
    }
}
