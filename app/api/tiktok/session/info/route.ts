import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const session = searchParams.get("session");

    if (!session) {
        return NextResponse.json({ error: "Missing session" }, { status: 400 });
    }

    try {
        const proxies = await prisma.systemProxy.findMany({ where: { isActive: true } });
        let proxyStr = "";
        if (proxies.length > 0) {
            const p = proxies[Math.floor(Math.random() * proxies.length)];
            proxyStr = `${p.host}:${p.port}:${p.username}:${p.password}`;
        }

        const apiUrl = `https://vubel-tiktok.vercel.app/api/info?session=${encodeURIComponent(session)}${proxyStr ? `&proxy=${encodeURIComponent(proxyStr)}` : ''}`;
        
        const res = await fetch(apiUrl);
        if (!res.ok) {
            throw new Error(`API returned ${res.status}`);
        }
        
        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
