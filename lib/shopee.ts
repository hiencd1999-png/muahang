export interface ShopeeProductDetails {
  shopId: string;
  itemId: string;
  productName: string;
  variants: string[];
  resolvedLink: string;
}

const LINK_PATTERNS = [
  /shopee\.vn\/[^^\/]+\/(\d+)\.(\d+)/i,
  /shopee\.vn\/product\/(\d+)\/(\d+)/i,
  /shopee\.vn\/[^^\/]+\/(\d+)\/(\d+)/i,
  /shopee\.vn\/.*?-i\.(\d+)\.(\d+)/i,
];

function extractShopAndItemIds(url: string) {
  for (const pattern of LINK_PATTERNS) {
    const match = pattern.exec(url);
    if (match) {
      return { shopId: match[1], itemId: match[2] };
    }
  }
  return { shopId: undefined, itemId: undefined };
}

async function resolveRedirectLink(productLink: string, cookie?: string) {
  try {
    const fixed = productLink.trim().startsWith("http") ? productLink.trim() : `https://${productLink.trim()}`;
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    };
    if (cookie) {
      headers.Cookie = cookie;
    }

    const response = await fetch(fixed, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers,
    });
    return response.url || fixed;
  } catch {
    return productLink.trim();
  }
}

async function fetchSharingLink(productLink: string, cookie?: string) {
  const encoded = encodeURIComponent(productLink.trim());
  const url = `https://mall.shopee.vn/api/v4/generic_sharing/get_sharing_link_for_non_affiliate?url=${encoded}`;
  const headers: Record<string, string> = {
    Host: "mall.shopee.vn",
    Cookie: cookie || "",
    "User-Agent": "iOS app iPhone Shopee appver=36931 language=vi app_type=1 platform=native_ios os_ver=26.3.0 Cronet/102.0.5005.61",
    "Content-Length": "4",
    Accept: "application/json, text/plain, */*",
    Origin: "https://mall.shopee.vn",
    Referer: "https://mall.shopee.vn/",
  };

  const response = await fetch(url, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Shopee share API phản hồi ${response.status}`);
  }

  const payload = await response.json();
  return String(payload?.data?.short_url || "");
}

async function resolveShopAndItemIds(productLink: string, cookie?: string) {
  const direct = extractShopAndItemIds(productLink);
  if (direct.shopId && direct.itemId) {
    return { ...direct, resolvedLink: productLink.trim() };
  }

  const resolved = await resolveRedirectLink(productLink, cookie);
  const second = extractShopAndItemIds(resolved);
  if (second.shopId && second.itemId) {
    return { ...second, resolvedLink: resolved };
  }

  try {
    const sharedLink = await fetchSharingLink(productLink, cookie);
    const sharedResolved = await resolveRedirectLink(sharedLink, cookie);
    const third = extractShopAndItemIds(sharedResolved);
    if (third.shopId && third.itemId) {
      return { ...third, resolvedLink: sharedResolved };
    }
  } catch {
    // ignore sharing fallback errors
  }

  return { shopId: undefined, itemId: undefined, resolvedLink: resolved };
}

export async function fetchShopeeProductDetails(productLink: string): Promise<ShopeeProductDetails> {
  const cookie = process.env.COOKIE?.trim();
  const { shopId, itemId, resolvedLink } = await resolveShopAndItemIds(productLink, cookie);

  if (!shopId || !itemId) {
    throw new Error("Không tìm thấy shopId hoặc itemId từ link Shopee.");
  }

  // Parse product name from the resolved link
  let productName = "Sản phẩm Shopee";
  try {
    const url = new URL(resolvedLink);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    if (pathSegments.length >= 2) {
      const candidate = decodeURIComponent(pathSegments[0].replace(/-/g, " "));
      if (candidate && !candidate.toLowerCase().includes("product") && !candidate.toLowerCase().includes("i.")) {
        productName = candidate;
      }
    }
  } catch {
    // ignore invalid URL parsing
  }

  return {
    shopId,
    itemId,
    productName,
    variants: [], // Empty variants, user will input manually
    resolvedLink,
  };
}
