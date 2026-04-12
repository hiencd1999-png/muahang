import { prisma } from "@/lib/prisma";
import nodeFetch from "node-fetch";
import { HttpsProxyAgent } from "https-proxy-agent";

async function getRandomSysProxy() {
  const proxies = await prisma.systemProxy.findMany({ where: { isActive: true } });
  if (proxies.length === 0) return undefined;
  const target = proxies[Math.floor(Math.random() * proxies.length)];
  return new HttpsProxyAgent(`http://${target.username}:${target.password}@${target.host}:${target.port}`);
}

export interface ShopeeVariant {
  modelId: number;
  name: string;
  price: number;
  stock: number;
}

export interface ShopeeProductDetails {
  shopId: string;
  itemId: string;
  productName: string;
  variants: ShopeeVariant[];
  resolvedLink: string;
}

const LINK_PATTERNS = [
  /shopee\.vn\/[^\/]+\/(\d+)\.(\d+)/i,
  /shopee\.vn\/product\/(\d+)\/(\d+)/i,
  /shopee\.vn\/[^\/]+\/(\d+)\/(\d+)/i,
  /shopee\.vn\/.*?-i\.(\d+)\.(\d+)/i,
];

function buildCanonicalLink(shopId: string, itemId: string) {
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

async function resolveRedirectLink(productLink: string, cookie?: string, proxyAgent?: any) {
  try {
    const fixed = productLink.trim().startsWith("http") ? productLink.trim() : `https://${productLink.trim()}`;
    
    // SSRF Protection: Only allow requests to shopee domains
    try {
      const parsedUrl = new URL(fixed);
      if (
        parsedUrl.hostname !== "shopee.vn" && 
        !parsedUrl.hostname.endsWith(".shopee.vn") &&
        parsedUrl.hostname !== "shp.ee" &&
        !parsedUrl.hostname.endsWith(".shp.ee")
      ) {
        return fixed; 
      }
    } catch {
      return fixed;
    }

    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    };
    if (cookie) {
      headers.Cookie = cookie;
    }

    const options: any = {
      method: "GET",
      follow: 5,
      headers,
    };
    if (proxyAgent) {
      options.agent = proxyAgent;
    }

    const response = await nodeFetch(fixed, options);
    return response.url || fixed;
  } catch {
    return productLink.trim();
  }
}

async function fetchSharingLink(productLink: string, cookie?: string, proxyAgent?: any) {
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

  const options: any = {
    method: "GET",
    headers,
  };
  if (proxyAgent) {
    options.agent = proxyAgent;
  }

  const response = await nodeFetch(url, options);
  if (!response.ok) {
    throw new Error(`Shopee share API phản hồi ${response.status}`);
  }

  const payload: any = await response.json();
  return String(payload?.data?.short_url || "");
}

async function resolveShopAndItemIds(productLink: string, cookie?: string, proxyAgent?: any) {
  const direct = extractShopAndItemIds(productLink);
  if (direct.shopId && direct.itemId) {
    return {
      ...direct,
      resolvedLink: buildCanonicalLink(direct.shopId, direct.itemId),
    };
  }

  const resolved = await resolveRedirectLink(productLink, cookie, proxyAgent);
  const second = extractShopAndItemIds(resolved);
  if (second.shopId && second.itemId) {
    return {
      ...second,
      resolvedLink: buildCanonicalLink(second.shopId, second.itemId),
    };
  }

  try {
    const sharedLink = await fetchSharingLink(productLink, cookie, proxyAgent);
    const sharedResolved = await resolveRedirectLink(sharedLink, cookie, proxyAgent);
    const third = extractShopAndItemIds(sharedResolved);
    if (third.shopId && third.itemId) {
      return {
        ...third,
        resolvedLink: buildCanonicalLink(third.shopId, third.itemId),
      };
    }
  } catch {
    // ignore sharing fallback errors
  }

  return { shopId: undefined, itemId: undefined, resolvedLink: resolved };
}

async function fetchProductData(shopId: string, itemId: string, cookie: string, proxyAgent?: any) {
  const url = `https://shopee.vn/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`;
  const headers = {
    Host: "shopee.vn",
    Cookie: cookie,
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": "Android app Shopee appver=28320 app_type=1",
  };

  try {
    const options: any = { headers };
    if (proxyAgent) {
      options.agent = proxyAgent;
    }

    const res = await nodeFetch(url, options);
    if (!res.ok) return null;
    const body: any = await res.json();
    if (body.error && body.error !== 0) return null;

    const data = body.data || {};
    const productName = data.name || "Sản phẩm Shopee";
    const models = data.models || [];
    
    const variants: ShopeeVariant[] = [];
    for (const item of models) {
      const modelId = item.modelid;
      if (!modelId) continue;
      
      const stock = item.stock ?? item.normal_stock ?? 0;
      if (stock > 0) {
         variants.push({
           modelId: Number(modelId),
           name: String(item.name || "Phân loại"),
           price: Math.floor((item.price || 0) / 100000), // convert to standard VND
           stock: Number(stock)
         });
      }
    }
    
    if (variants.length === 0 && (data.stock ?? data.normal_stock ?? 0) > 0) {
      // Default fallback variant if no models but product has stock
      variants.push({
         modelId: 0,
         name: "Mặc định",
         price: Math.floor((data.price || data.price_min || 0) / 100000),
         stock: Number(data.stock ?? data.normal_stock ?? 1)
      });
    }

    return { productName, variants };
  } catch (err) {
    return null;
  }
}

export async function fetchShopeeProductDetails(productLink: string, overrideCookie?: string): Promise<ShopeeProductDetails> {
  const sysConfig = await prisma.systemConfig.findUnique({ where: { key: "SHOPEE_SPC_ST" } });
  let cookie = overrideCookie || (sysConfig?.value || process.env.COOKIE || "").trim();
  
  if (cookie && !cookie.includes("SPC_ST=")) {
    cookie = `SPC_ST=${cookie}`;
  }

  const proxyAgent = await getRandomSysProxy();

  const { shopId, itemId, resolvedLink } = await resolveShopAndItemIds(productLink, cookie, proxyAgent);

  if (!shopId || !itemId) {
    throw new Error("Không tìm thấy shopId hoặc itemId từ link Shopee.");
  }

  const prodData = await fetchProductData(shopId, itemId, cookie, proxyAgent);
  let productName = prodData?.productName || "Sản phẩm Shopee";

  if (!prodData || productName === "Sản phẩm Shopee") {
    // Try to parse from BOTH original link and resolved link
    const fixedProductLink = productLink.trim().startsWith("http") ? productLink.trim() : `https://${productLink.trim()}`;
    const urlsToTry = [fixedProductLink, resolvedLink];
    for (const link of urlsToTry) {
      try {
        const urlObj = new URL(link);
        const pathSegments = urlObj.pathname.split("/").filter(Boolean);
        if (pathSegments.length >= 1) {
          let candidate = decodeURIComponent(pathSegments[0]);
          if (candidate.toLowerCase() !== "product") {
            if (candidate.includes("-i.")) {
               candidate = candidate.split("-i.")[0];
            }
            candidate = candidate.replace(/-/g, " ").trim();
            if (candidate && candidate.length > 5) {
               productName = candidate;
               break; // found name, exit loop
            }
          }
        }
      } catch {
        // ignore invalid URL parsing for this specific link
      }
    }
  }

  return {
    shopId,
    itemId,
    productName,
    variants: prodData?.variants || [],
    resolvedLink,
  };
}
