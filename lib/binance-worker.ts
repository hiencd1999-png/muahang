import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { HttpsProxyAgent } from "https-proxy-agent";
import fetch from "node-fetch";

const BINANCE_KEY = process.env.BINANCE_KEY;
const BINANCE_SECRET = process.env.BINANCE_SECRET;
const BINANCE_PROXY = process.env.BINANCE_PROXY;
const USDT_RATE = parseInt(process.env.USDT_RATE || "25500", 10);

let timeOffset = 0;

async function syncBinanceTime() {
    try {
        const res = await fetch("https://api.binance.com/api/v3/time");
        if (res.ok) {
            const data = await res.json();
            timeOffset = data.serverTime - Date.now();
        }
    } catch (e) {
        console.error("Lỗi đồng bộ time:", e);
    }
}

async function binanceApiRequest(endpoint: string, params: Record<string, any>) {
    if (!BINANCE_KEY || !BINANCE_SECRET) return null;

    if (timeOffset === 0) {
        await syncBinanceTime();
    }

    const timestamp = Date.now() + timeOffset;
    const queryParams = new URLSearchParams({
        ...params,
        recvWindow: "60000", // Thêm recvWindow tối đa
        timestamp: timestamp.toString()
    });

    const signature = crypto.createHmac("sha256", BINANCE_SECRET).update(queryParams.toString()).digest("hex");
    queryParams.append("signature", signature);

    const url = `https://api.binance.com${endpoint}?${queryParams.toString()}`;
    
    let agent;
    if (BINANCE_PROXY) {
        let proxyUrl = BINANCE_PROXY;
        if (!proxyUrl.startsWith("http")) {
            const parts = proxyUrl.split(":");
            if (parts.length === 4) {
                proxyUrl = `http://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`;
            } else if (parts.length === 2) {
                proxyUrl = `http://${parts[0]}:${parts[1]}`;
            } else {
                proxyUrl = `http://${proxyUrl}`;
            }
        }
        agent = new HttpsProxyAgent(proxyUrl);
    }

    const response = await fetch(url, {
        method: "GET",
        headers: {
            "X-MBX-APIKEY": BINANCE_KEY
        },
        agent: agent as any
    });

    if (!response.ok) {
        const text = await response.text();
        console.error(`[Binance-API] Lỗi: HTTP ${response.status} - ${text}`);
        
        // Nếu lỗi do lệch time, reset timeOffset để call lại round sau
        if (text.includes("-1021")) {
            timeOffset = 0; 
        }
        return null;
    }

    return await response.json();
}

let isUSDTTrackerRunning = false;

export async function runBinanceUSDTTracker() {
    if (isUSDTTrackerRunning) return;
    if (!BINANCE_KEY || !BINANCE_SECRET) return;

    isUSDTTrackerRunning = true;

    try {
        // Lấy danh sách lệnh đang chờ
        const pendingDeposits = await prisma.cryptoDeposit.findMany({
            where: { status: "PENDING" },
            include: { user: true }
        });

        if (pendingDeposits.length === 0) return;

        // Cập nhật trạng thái những lệnh đã hết hạn
        const now = new Date();
        const expiredIds: string[] = [];
        const activeDeposits = [];

        for (const deposit of pendingDeposits) {
            if (now > deposit.expiresAt) {
                expiredIds.push(deposit.id);
            } else {
                activeDeposits.push(deposit);
            }
        }

        if (expiredIds.length > 0) {
            await prisma.cryptoDeposit.updateMany({
                where: { id: { in: expiredIds } },
                data: { status: "EXPIRED" }
            });
            console.log(`[Binance-USDT] Đã cập nhật ${expiredIds.length} lệnh quá hạn thành EXPIRED.`);
        }

        if (activeDeposits.length === 0) return;

        // Gọi Binance API
        const endTime = Date.now();
        const startTime = endTime - 30 * 60 * 1000; // 30 phút gần nhất

        for (const network of ["BSC", "TRX"]) {
            // Lọc ra các lệnh active thuộc network này
            const networkDeposits = activeDeposits.filter(d => d.network === network);
            if (networkDeposits.length === 0) continue;

            const records: any = await binanceApiRequest("/sapi/v1/capital/deposit/hisrec", {
                coin: "USDT",
                network: network,
                startTime,
                endTime,
                status: 1 // Chỉ lấy giao dịch thành công
            });

            if (!Array.isArray(records)) continue;

            for (const tx of records) {
                const txAmount = parseFloat(tx.amount);
                const txId = tx.txId;
                const txAddress = tx.address?.toLowerCase(); // Ví nhận
                
                // So khớp
                for (const deposit of networkDeposits) {
                    if (deposit.status !== "PENDING") continue;
                    
                    // So số tiền thập phân (tránh sai số JS)
                    const diff = Math.abs(txAmount - deposit.expectedAmount);
                    if (diff > 0.000001) continue;

                    // So địa chỉ
                    if (deposit.address.toLowerCase() !== txAddress) continue;

                    // Khớp -> Duyệt lệnh
                    const vndAmount = deposit.amount * USDT_RATE;

                    try {
                        await prisma.$transaction(async (db) => {
                            // Check coi giao dịch này đã process chưa (bằng txId)
                            const existedTx = await db.cryptoDeposit.findFirst({
                                where: { txId: txId }
                            });

                            if (existedTx) throw new Error("DUPLICATE_TX");

                            await db.cryptoDeposit.update({
                                where: { id: deposit.id },
                                data: {
                                    status: "COMPLETED",
                                    txId: txId
                                }
                            });

                            await db.user.update({
                                where: { id: deposit.userId },
                                data: { balance: { increment: vndAmount } }
                            });

                            await db.transaction.create({
                                data: {
                                    userId: deposit.userId,
                                    amount: vndAmount,
                                    type: "DEPOSIT",
                                    note: `Nạp ${deposit.expectedAmount} USDT mạng ${deposit.network} (Tx: ${txId})`
                                }
                            });

                            await db.notification.create({
                                data: {
                                    userId: deposit.userId,
                                    type: "DEPOSIT_SUCCESS",
                                    title: "Nạp USDT thành công",
                                    message: `Bạn đã nạp thành công ${deposit.expectedAmount} USDT. +${vndAmount.toLocaleString("vi-VN")} đ.`,
                                    link: "/dashboard/deposit/history"
                                }
                            });
                        });

                        deposit.status = "COMPLETED" as any; // Đánh dấu để khỏi match lại
                        console.log(`[Binance-USDT] Lệnh ${deposit.id} (nạp ${deposit.expectedAmount} USDT) đã COMPLETED!`);
                    } catch (txErr: any) {
                        if (txErr.message !== "DUPLICATE_TX") {
                            console.error(`[Binance-USDT] Lỗi update khi duyệt lệnh ${deposit.id}: ${txErr.message}`);
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error("🔥 [Binance-USDT] Có lỗi:", err);
    } finally {
        isUSDTTrackerRunning = false;
    }
}
