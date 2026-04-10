import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, verifyTemp2FAToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authenticator } from "otplib";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
    try {
        const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
        const { allowed } = checkRateLimit(`login2fa_${ip}`, 5, 5 * 60 * 1000); 
        if (!allowed) {
            return NextResponse.json({ error: "Thử sai 2FA quá nhiều lần. Vui lòng quay lại sau 5 phút!" }, { status: 429 });
        }

        const { otp } = await req.json();
        if (!otp) return NextResponse.json({ error: "Thiếu mã xác thực." }, { status: 400 });

        const cookieStore = await cookies();
        const tempToken = cookieStore.get("datdon_2fa_temp")?.value;
        if (!tempToken) {
            return NextResponse.json({ error: "Phiên đăng nhập quá hạn, vui lòng đăng nhập lại." }, { status: 401 });
        }

        const userIdStr = String(await verifyTemp2FAToken(tempToken));
        const user = await prisma.user.findUnique({ where: { id: parseInt(userIdStr, 10) } });
        
        if (!user || !user.twoFactorSecret) {
             return NextResponse.json({ error: "Tài khoản không hợp lệ." }, { status: 403 });
        }

        authenticator.options = { window: 3 }; // Dung sai 3 chu kỳ (90 giây) hai chiều
        const cleanToken = String(otp).replace(/\s+/g, '');
        const isValid = authenticator.verify({ token: cleanToken, secret: user.twoFactorSecret });
        if (!isValid) {
             return NextResponse.json({ error: "Mã Authenticator không đúng." }, { status: 401 });
        }

        // Tạo token đăng nhập chuẩn
        const sessionToken = await createSessionToken({
            sub: String(user.id),
            username: user.username,
            role: user.role,
        });

        const isHttps = req.headers.get("x-forwarded-proto") === "https";

        // Xóa temp và ghi temp chuẩn
        cookieStore.delete("datdon_2fa_temp");
        resetRateLimit(`login2fa_${ip}`);
        
        cookieStore.set(SESSION_COOKIE, sessionToken, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production" && isHttps,
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
        });

        return NextResponse.json({ success: true, message: "Đăng nhập với 2FA thành công" });
    } catch(e: any) {
        return NextResponse.json({ error: "Phiên 2FA không hợp lệ hoặc lỗi máy chủ." }, { status: 500 });
    }
}
