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
  spcCookie?: string;
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

  const spcCookie = normalizeSpcSt(input.spcCookie || process.env.COOKIE || "");
  if (!spcCookie) {
    throw new Error("Thiếu SPC_ST để gọi Shopee autofill.");
  }

  const phone = normalizePhone(input.phone || "");
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

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Shopee autofill lỗi HTTP ${response.status}.`);
  }

  if (payload?.error !== 0) {
    throw new Error(payload?.error_msg || "Shopee autofill trả lỗi.");
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