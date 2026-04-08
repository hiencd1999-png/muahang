export const ORDER_UNIT_PRICE = 75_000;

export function calculateOrderTotal(quantity: number) {
  return Math.max(1, quantity) * ORDER_UNIT_PRICE;
}

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

export function suggestAddressOptions(address: string): string[] {
  const normalized = address
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ");

  if (!normalized) {
    return [];
  }

  const suggestions = new Set<string>();
  suggestions.add(normalized);

  const parts = normalized.split(/[,\-]/).map((segment) => segment.trim()).filter(Boolean);
  if (parts.length > 1) {
    suggestions.add(parts.join(", "));
    suggestions.add(parts.reverse().join(", "));
  }

  if (!normalized.includes(",")) {
    const splitted = normalized.split(" ");
    if (splitted.length > 4) {
      suggestions.add(`${splitted.slice(0, 3).join(" ")}, ${splitted.slice(3).join(" ")}`);
    }
  }

  return Array.from(suggestions).slice(0, 4);
}
