export function isValidShopeeLink(link: string) {
  return /shopee/i.test(link);
}

interface ParsedShopeeLink {
  shopId?: string;
  itemId?: string;
  productName: string;
  variants: string[];
}

const LINK_PATTERNS = [
  /shopee\.vn\/[^\/]+\/(\d+)\.(\d+)/i,
  /shopee\.vn\/product\/(\d+)\/(\d+)/i,
  /shopee\.vn\/[^\/]+\/(\d+)\/(\d+)/i,
  /shopee\.vn\/.*?-i\.(\d+)\.(\d+)/i,
];

export function buildCanonicalShopeeLink(shopId: string, itemId: string) {
  return `https://shopee.vn/product/${shopId}/${itemId}`;
}

function extractShopAndItemIds(url: string) {
  for (const pattern of LINK_PATTERNS) {
    const match = pattern.exec(url);
    if (match) {
      return { shopId: match[1], itemId: match[2] };
    }
  }
  return { shopId: undefined, itemId: undefined };
}

export function parseShopeeProductLink(link: string): ParsedShopeeLink {
  const productLink = link.trim();
  const inputLink = productLink.startsWith("http") ? productLink : `https://${productLink}`;

  const { shopId, itemId } = extractShopAndItemIds(productLink);
  let productName = "Sản phẩm Shopee";
  let variants = ["Mặc định"];

  try {
    const url = new URL(inputLink);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    if (pathSegments.length >= 2) {
      const candidate = decodeURIComponent(pathSegments[0].replace(/-/g, " "));
      if (candidate && !candidate.toLowerCase().includes("product") && !candidate.toLowerCase().includes("i.")) {
        productName = candidate;
      }
    }

    const modelId =
      url.searchParams.get("modelid") ||
      url.searchParams.get("model_id") ||
      url.searchParams.get("variation_ids") ||
      url.searchParams.get("variation");

    const modelName = url.searchParams.get("model_name") || url.searchParams.get("variant_name");
    const selection = modelName || modelId;
    if (selection) {
      variants = [`${modelName ? modelName : `Phân loại ${selection}`}`, "Mặc định"];
    }
  } catch {
    // ignore invalid URL parsing on client
  }

  if (!shopId || !itemId) {
    variants = ["Mặc định"];
  }

  return {
    shopId,
    itemId,
    productName,
    variants,
  };
}

function normalizePhone(phoneOrText: string) {
  const digits = (phoneOrText || "").replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  if (digits.length === 9) {
    return `0${digits}`;
  }

  return digits;
}

function sanitizeFragment(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*[-–]\s*/g, " - ");
}

function dedupeByNormalizedSpace(values: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const key = value.replace(/\s+/g, " ").trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(value.replace(/\s+/g, " ").trim());
  }

  return output;
}

export function suggestAddressOptions(address: string, note = ""): string[] {
  const normalized = sanitizeFragment(address);

  if (!normalized) {
    return [];
  }

  const normalizedNote = sanitizeFragment(note);

  // Follow add_diachi.py behavior: strip to digits and normalize 9-digit numbers to leading-0 format.
  const normalizedPhone = normalizePhone(`${normalizedNote} ${normalized}`);

  const suggestions: string[] = [normalized];

  if (normalizedPhone) {
    suggestions.push(`${normalized} - SĐT ${normalizedPhone}`);
    suggestions.push(`${normalized}\nSĐT: ${normalizedPhone}`);
  }

  if (normalizedNote) {
    suggestions.push(`${normalizedNote} ${normalized}`);
    suggestions.push(`${normalized}\nGhi chú: ${normalizedNote}`);

    if (normalizedPhone) {
      suggestions.push(`${normalizedNote} ${normalized} - SĐT ${normalizedPhone}`);
    }
  }

  const parts = normalized
    .split(/[,-]/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (parts.length > 1) {
    suggestions.push(parts.join(", "));

    const reversed = [...parts].reverse();
    suggestions.push(reversed.join(", "));
  }

  if (!normalized.includes(",")) {
    const splitted = normalized.split(" ");
    if (splitted.length > 4) {
      suggestions.push(`${splitted.slice(0, 3).join(" ")}, ${splitted.slice(3).join(" ")}`);
    }
  }

  return dedupeByNormalizedSpace(suggestions).slice(0, 6);
}
