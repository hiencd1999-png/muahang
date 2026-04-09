import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { authenticator } from "otplib";

export async function POST(req: Request) {
    const session = await requireApiUser();
    if ("error" in session) return NextResponse.json({ error: session.error }, { status: session.status });

    if (!session.user.twoFactorEnabled) {
        return NextResponse.json({ error: "2FA chưa được bật." }, { status: 400 });
    }

    try {
        const { token } = await req.json();

        const user = await prisma.user.findUnique({ where: { id: session.user.id } });
        if (!user?.twoFactorSecret) {
            return NextResponse.json({ error: "Lỗi dữ liệu 2FA." }, { status: 400 });
        }

        authenticator.options = { window: 3 }; // Dung sai 3 chu kỳ (90 giây) hai chiều
        const cleanToken = String(token).replace(/\s+/g, '');
        const isValid = authenticator.verify({ token: cleanToken, secret: user.twoFactorSecret });
        if (!isValid) {
            return NextResponse.json({ error: "Mã OTP không hợp lệ, vui lòng thử lại." }, { status: 400 });
        }

        await prisma.user.update({
            where: { id: session.user.id },
            data: { twoFactorEnabled: false, twoFactorSecret: null }
        });

        return NextResponse.json({ success: true, message: "Đã gỡ bỏ 2FA bảo mật." });
    } catch(e) {
        return NextResponse.json({ error: "Lỗi vô hiệu hóa 2FA" }, { status: 500 });
    }
}
