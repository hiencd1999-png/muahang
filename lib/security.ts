/**
 * DATDON - SYSTEM SECURITY LAYER (Rate Limit, CSRF, Idempotency, Signature)
 */
import { createHmac } from "crypto";

// Bộ nhớ Cache nội bộ (Trong mội trường Production Microservice sẽ thay bằng Redis)
const rateLimits = new Map<string, { count: number; expiresAt: number }>();
const idempotencyKeys = new Map<string, number>();

/**
 * Lấy IP độc bản của Request (Hỗ trợ định tuyến qua Nginx/Cloudflare)
 */
export function getClientIp(req: Request): string {
    return req.headers.get('cf-connecting-ip') || 
           req.headers.get('x-forwarded-for')?.split(',')[0] || 
           '127.0.0.1';
}

/**
 * 1. Cơ chế RATE LIMITING API (Giới hạn requests)
 * @returns true nếu pass, false nếu bị chặn
 */
export function verifyRateLimit(ip: string, limit: number, windowMs: number = 60000): boolean {
    const now = Date.now();
    const record = rateLimits.get(ip);

    if (!record || record.expiresAt < now) {
        rateLimits.set(ip, { count: 1, expiresAt: now + windowMs });
        return true;
    }
    if (record.count >= limit) return false;
    record.count++;
    return true;
}

/**
 * 2. CƠ CHẾ CHỐNG REPLAY ATTACK (Idempotency Key)
 * Yêu cầu Client gửi kèm `X-Idempotency-Key` (UUID4) trên Headers khi gọi các API trừ tiền.
 * @returns true nếu hợp lệ, false nếu key đã được xử lý
 */
export function verifyIdempotency(key: string, lockWindowMs: number = 24 * 60 * 60 * 1000): boolean {
    if (!key) return false;
    
    const now = Date.now();
    const expiry = idempotencyKeys.get(key);

    if (expiry && expiry > now) {
         return false; // Key này đã được gửi lên hệ thống và bị khóa (Double Click / Replay Request)
    }

    idempotencyKeys.set(key, now + lockWindowMs);
    return true;
}

/**
 * 3. KÝ GIAO DỊCH (Transaction Signature/HMAC)
 * Mã hóa payload bằng thuật toán HMAC SHA256 kèm theo Secret của User/Admin 
 * Ngăn chặn tuyệt đối can thiệp HTTP Interceptors trên đường truyền.
 */
export function verifySignature(payloadString: string, providedSignature: string, userSecret: string): boolean {
    if (!payloadString || !providedSignature || !userSecret) return false;

    const expectedSignature = createHmac("sha256", userSecret)
        .update(payloadString)
        .digest("hex");

    return expectedSignature === providedSignature;
}

/**
 * Cleanup Rác Memory
 */
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of Array.from(rateLimits.entries())) {
        if (data.expiresAt < now) rateLimits.delete(ip);
    }
    for (const [key, expires] of Array.from(idempotencyKeys.entries())) {
        if (expires < now) idempotencyKeys.delete(key);
    }
}, 5 * 60 * 1000);
