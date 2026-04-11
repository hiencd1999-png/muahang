import { prisma } from "@/lib/prisma";

const AUTOFILL_URL = "https://mall.shopee.vn/api/v4/account/address/autofill";
const DEFAULT_LAT = 21.026140213012695;
const DEFAULT_LNG = 105.84101104736328;

function normalizeSpcSt(cookie: string) {
  const raw = (cookie || "").trim();
  if (!raw) {
    return "";
  }

  if (raw.includes("SPC_ST=")) {
    return raw;
  }

  return `SPC_ST=${raw}`;
}

function normalizePhone(phone: string) {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  if (digits.length === 9) {
    return `0${digits}`;
  }

  return digits;
}

function compact(value: string) {
  return (value || "").trim().replace(/\s+/g, " ");
}

function buildSuggestionList(
  detailedAddress: string,
  adminDivision1: string,
  adminDivision2: string,
  adminDivision3: string,
  phone: string,
  note: string
) {
  const base = compact(detailedAddress);
  const districtStack = [adminDivision3, adminDivision2, adminDivision1]
    .map(compact)
    .filter(Boolean)
    .join(", ");

  const normalizedPhone = normalizePhone(phone);
  const normalizedNote = compact(note);
  const suggestions = new Set<string>();

  if (base) {
    suggestions.add(base);
  }

  if (base && districtStack) {
    suggestions.add(`${base}, ${districtStack}`);
  }

  if (base && normalizedPhone) {
    suggestions.add(`${base} - SĐT ${normalizedPhone}`);
    suggestions.add(`${base}\nSĐT: ${normalizedPhone}`);
  }

  if (normalizedNote && base) {
    suggestions.add(`${normalizedNote} ${base}`);
    suggestions.add(`${base}\nGhi chú: ${normalizedNote}`);
  }

  if (normalizedNote && base && normalizedPhone) {
    suggestions.add(`${normalizedNote} ${base} - SĐT ${normalizedPhone}`);
  }

  return Array.from(suggestions).slice(0, 6);
}

export interface ShopeeAddressAnalyzeInput {
  address: string;
  phone?: string;
  note?: string;
}

export interface ShopeeAddressAnalyzeResult {
  suggestions: string[];
  parsed: {
    detailedAddress: string;
    adminDivision1: string;
    adminDivision2: string;
    adminDivision3: string;
    phone: string;
  };
}

export async function analyzeShopeeAddress(input: ShopeeAddressAnalyzeInput): Promise<ShopeeAddressAnalyzeResult> {
  const rawAddress = compact(input.address);
  if (!rawAddress) {
    throw new Error("Thiếu địa chỉ để phân tích.");
  }

  const phone = normalizePhone(input.phone || "");

  const sysConfig = await prisma.systemConfig.findUnique({ where: { key: "SHOPEE_SPC_ST" } });
  const spcCookieEnv = normalizeSpcSt(sysConfig?.value || process.env.COOKIE || "");
  const activeOrder = await prisma.order.findFirst({
    where: { spcCookie: { not: "" } },
    orderBy: { createdAt: "desc" },
    select: { spcCookie: true }
  });
  const spcCookieDb = activeOrder ? normalizeSpcSt(activeOrder.spcCookie!) : "";

  const cookiesToTry = Array.from(new Set([spcCookieEnv, spcCookieDb].filter(Boolean)));
  if (cookiesToTry.length === 0) {
    throw new Error("Hệ thống thiếu cấu hình SPC_ST (Cả server web và Admin duyệt đơn đều trống).");
  }

  let lastError: Error | null = null;
  let payload: any = null;

  for (const spcCookie of cookiesToTry) {
    try {
      const csrfToken = crypto.randomUUID().replace(/-/g, "");
      const pageSessionId = crypto.randomUUID();

      const response = await fetch(AUTOFILL_URL, {
        method: "POST",
        cache: "no-store",
        headers: {
          Host: "mall.shopee.vn",
          Cookie: `csrftoken=${csrfToken}; ${spcCookie}`,
          "Content-Type": "application/json",
          "X-Csrftoken": csrfToken,
          "X-Api-Source": "rn",
          "User-Agent": "iOS app iPhone Shopee appver=36476 language=vi app_type=1 platform=native_ios",
          Referer: "https://mall.shopee.vn/",
          "Accept-Language": "vi-VN,vi,en-US,en",
        },
        body: JSON.stringify({
          input: `${rawAddress} ${phone}`.trim(),
          user_lng: DEFAULT_LNG,
          user_lat: DEFAULT_LAT,
          request_type: "pasting",
          use_case: "shopee.account",
          page_session_id: pageSessionId,
          translate_detailed_address: false,
        }),
      });

      const p = await response.json().catch(() => ({}));
      if (response.ok && p?.error === 0) {
        payload = p;
        break; // Tự động dừng vòng lặp nếu cookie ok
      } else {
        lastError = new Error(p?.error_msg || `Shopee autofill lỗi HTTP ${response.status}.`);
      }
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  if (!payload) {
    throw lastError || new Error("Shopee autofill bị từ chối bằng tất cả các cookie có sẵn.");
  }

  const data = payload?.data || {};
  const adminInfo = data?.admin_info || {};

  const detailedAddress = compact(data?.detailed_address || rawAddress);
  const adminDivision1 = compact(adminInfo?.admin_division_1 || "");
  const adminDivision2 = compact(adminInfo?.admin_division_2 || "");
  const adminDivision3 = compact(adminInfo?.admin_division_3 || "");
  const parsedPhone = normalizePhone(data?.phone || phone);

  const suggestions = buildSuggestionList(
    detailedAddress,
    adminDivision1,
    adminDivision2,
    adminDivision3,
    parsedPhone,
    input.note || ""
  );

  if (suggestions.length === 0) {
    throw new Error("Shopee autofill không trả về gợi ý hợp lệ.");
  }

  return {
    suggestions,
    parsed: {
      detailedAddress,
      adminDivision1,
      adminDivision2,
      adminDivision3,
      phone: parsedPhone,
    },
  };
}