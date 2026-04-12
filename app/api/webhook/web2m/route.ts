import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Hàm chuẩn hóa chuỗi: Bỏ dấu tiếng Việt, in hoa, xóa khoảng trắng thừa
function normalizeString(str: string): string {
    if (!str) return "";
    return String(str)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Xóa dấu
        .replace(/đ/g, "d").replace(/Đ/g, "D")
        .toUpperCase()
        .replace(/\s+/g, " ")
        .trim();
}

export async function POST(req: NextRequest) {
    // 1. Kiểm tra header Authorization
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new NextResponse("Access Token không được cung cấp hoặc không hợp lệ.", { status: 401 });
    }

    const bearerToken = authHeader.substring(7);

    try {
        // 2. Định danh Admin qua Token
        // Web2M token của mỗi admin được cấu hình tại trang AdminBankConfig
        const adminConfig = await prisma.adminBankConfig.findFirst({
            where: { web2mToken: bearerToken }
        });

        if (!adminConfig) {
            return new NextResponse("Chữ ký không hợp lệ hoặc Token chưa được cấu hình trên hệ thống.", { status: 401 });
        }

        // 3. Phân tích Dữ liệu từ Webhook
        const body = await req.json();
        console.log("Web2M Payload Receieved:", JSON.stringify(body));

        let transactions: any[] = [];
        if (Array.isArray(body)) {
            transactions = body;
        } else if (body.data && Array.isArray(body.data)) {
            transactions = body.data;
        } else if (body.transactions && Array.isArray(body.transactions)) {
            transactions = body.transactions;
        }

        for (const tx of transactions) {
            // Web2M thường có type là IN/OUT, +/-, hoặc không có
            const typeStr = String(tx.type || tx.transactionType || "IN").toUpperCase();
            
            if (typeStr === "IN" || typeStr === "+" || typeStr === "CREDIT") {
                const txAmount = Number(tx.amount || tx.tien_vao || 0);
                const txDesc = normalizeString(tx.description || tx.noi_dung || "");

                if (txAmount > 0) {
                        // 4. Tìm kiếm Lệnh nạp tiền PENDING khớp cú pháp
                        // Mã transferCode có dạng "DDxxxxxx", ta tìm xem BankDeposit nào của admin này đang chờ duyệt
                        // Thường TransferCode sẽ nằm nguyên vẹn trong nội dung chuyển khoản
                        const targetDeposits = await prisma.bankDeposit.findMany({
                            where: {
                                adminId: adminConfig.adminId,
                                amount: txAmount, // Số tiền gửi đến phải khớp số tiền tạo lệnh để tránh fake
                                status: { in: ["PENDING", "TRANSFERRED", "COMPLAINED"] },
                                transferCode: { not: null }
                            }
                        });

                        // Xác định xem Description có chứa mã nào không
                        for (const deposit of targetDeposits) {
                            if (deposit.transferCode && txDesc.includes(normalizeString(deposit.transferCode))) {
                                // KHỚP MÃ CÚ PHÁP VÀ SỐ TIỀN -> DUYỆT TỰ ĐỘNG
                                try {
                                    await prisma.$transaction(async (dbTx) => {
                                        // Dùng updateMany để chống Race Condition cực gắt
                                        const updateResult = await dbTx.bankDeposit.updateMany({
                                            where: { 
                                                id: deposit.id, 
                                                status: deposit.status
                                            },
                                            data: { status: "COMPLETED", complaintImage: null, updatedAt: new Date() }
                                        });

                                        if (updateResult.count === 0) {
                                            // Đã được người khác hoặc tiến trình khác duyệt trước miligiay
                                            throw new Error("ALREADY_PROCESSED");
                                        }

                                        // Cộng tiền cho User
                                        await dbTx.user.update({
                                            where: { id: deposit.userId },
                                            data: { balance: { increment: deposit.amount } }
                                        });

                                        // Lưu lịch sử
                                        await dbTx.transaction.create({
                                            data: {
                                                userId: deposit.userId,
                                                amount: deposit.amount,
                                                type: "DEPOSIT",
                                                note: `Auto Web2M: Nạp tiền Bank Nội Bộ thành công (Admin ID ${deposit.adminId})`
                                            }
                                        });
                                    });

                                    // Gửi Telegram (Không chặn luồng chính nếu lỗi gửi tele)
                                    try {
                                        const { sendTelegramNotification } = await import("@/lib/telegram");
                                        await sendTelegramNotification(
                                            deposit.userId, 
                                            `🎉 *Nạp Tự Động Thành Công*\nTuyệt vời! Máy chủ tự động ghi nhận lệnh nạp ${deposit.amount.toLocaleString("vi-VN")} VND của bạn thông qua Web2M Bank API. Số dư đã cập nhật tức thì.`, 
                                            "USER_DEPOSIT"
                                        );
                                    } catch (err) {}
                                    
                                } catch (error) {
                                    // Log âm thầm nếu lỗi transaction
                                    console.error("Web2M Auto Appprove Error:", error);
                                }
                                
                                // Nếu đã xử lý 1 lệnh trùng khớp thì dừng vòng lặp đi tìm lệnh thứ 2
                                break;
                            }
                        }
                    }
                }
            }

        // Webhook của hãng yêu cầu trả lời "OK" kèm status = true
        return NextResponse.json({ status: true, msg: "Ok" }, { status: 200 });

    } catch (error) {
        console.error("Web2M Webhook Error:", error);
        // Trừ khi Token sai, nếu có lỗi catch ngoài thì vẫn trả về 200 OK để Web2M không gửi loop spam.
        return NextResponse.json({ status: true, msg: "Lỗi trong backend tự động xử lý. Đã bỏ qua." }, { status: 200 });
    }
}
