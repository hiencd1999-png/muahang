import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { authenticator } from "otplib";
import QRCode from "qrcode";

export async function POST() {
    const session = await requireApiUser();
    if ("error" in session) return NextResponse.json({ error: session.error }, { status: session.status });

    if (session.user.twoFactorEnabled) {
        return NextResponse.json({ error: "2FA đã được bật, không thể tạo mới." }, { status: 400 });
    }

    try {
        const secret = authenticator.generateSecret();
        const otpauth = authenticator.keyuri(session.user.username, "Datdon.local", secret);
        const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

        await prisma.user.update({
            where: { id: session.user.id },
            data: { twoFactorSecret: secret }
        });

        return NextResponse.json({ secret, qrCode: qrCodeDataUrl });
    } catch(e) {
        return NextResponse.json({ error: "Lỗi tạo cấu hình 2FA" }, { status: 500 });
    }
}
