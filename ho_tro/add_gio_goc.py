import json
import re
import sys
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple
from urllib import error, parse, request
from playwright.sync_api import sync_playwright

GET_RATINGS_URL = "https://shopee.vn/api/v2/item/get_ratings"
GET_ITEM_URL = "https://shopee.vn/api/v4/item/get"
ADD_TO_CART_URL = "https://shopee.vn/api/v4/cart/add_to_cart"
SHARING_API_URL = "https://mall.shopee.vn/api/v4/generic_sharing/get_sharing_link_for_non_affiliate"
DEFAULT_TIMEOUT = 60


@dataclass
class ProductVariant:
    modelid: int
    model_name: str
    item_name: str
    price: int = 0
    has_stock: bool = True


def normalize_spc_st(cookie: str) -> str:
    value = (cookie or "").strip()
    if not value:
        return ""
    if "SPC_ST=" in value:
        return value
    return f"SPC_ST={value}"


def request_json(
    url: str,
    method: str = "GET",
    headers: Optional[Dict[str, str]] = None,
    payload: Optional[Dict[str, Any]] = None,
    timeout: int = DEFAULT_TIMEOUT,
) -> Tuple[int, Dict[str, Any]]:
    body = None
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")

    req = request.Request(
        url=url,
        method=method,
        data=body,
        headers=headers or {},
    )

    try:
        with request.urlopen(req, timeout=timeout) as response:
            content = response.read().decode("utf-8", errors="replace")
            return response.status, json.loads(content) if content else {}
    except error.HTTPError as exc:
        content = exc.read().decode("utf-8", errors="replace")
        try:
            data = json.loads(content) if content else {}
        except json.JSONDecodeError:
            data = {"message": content or str(exc)}
        return exc.code, data


def resolve_short_link(product_link: str, cookie: str) -> str:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }
    if "s.shopee.vn" in product_link:
        headers["Cookie"] = cookie

    req = request.Request(product_link, method="GET", headers=headers)
    with request.urlopen(req, timeout=DEFAULT_TIMEOUT) as response:
        return response.geturl()


def extract_shop_item_from_url(url: str) -> Optional[Tuple[str, str]]:
    patterns = [
        r"shopee\.vn\/[^\/]+\/(\d+)\.(\d+)",
        r"shopee\.vn\/product\/(\d+)\/(\d+)",
        r"shopee\.vn\/[^\/]+\/(\d+)\/(\d+)",
        r"shopee\.vn\/.*?-i\.(\d+)\.(\d+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1), match.group(2)
    return None


def parse_product_link(product_link: str, cookie: str) -> Tuple[str, str, str]:
    direct = extract_shop_item_from_url(product_link)
    if direct:
        return direct[0], direct[1], product_link

    try:
        resolved = resolve_short_link(product_link, cookie)
        resolved_ids = extract_shop_item_from_url(resolved)
        if resolved_ids:
            return resolved_ids[0], resolved_ids[1], resolved
    except Exception:
        pass

    encoded = parse.quote(product_link.strip(), safe="")
    sharing_url = f"{SHARING_API_URL}?url={encoded}"
    status, payload = request_json(
        sharing_url,
        method="GET",
        headers={
            "Host": "mall.shopee.vn",
            "Cookie": cookie,
            "User-Agent": "iOS app iPhone Shopee appver=36931 language=vi app_type=1 platform=native_ios os_ver=26.3.0 Cronet/102.0.5005.61",
            "Content-Length": "4",
        },
    )

    if status != 200:
        raise RuntimeError(f"Sharing API failed HTTP {status}: {payload}")

    short_url = ((payload.get("data") or {}).get("short_url") or "").strip()
    if not short_url:
        raise RuntimeError("Cannot parse product link")

    from_share = extract_shop_item_from_url(short_url)
    if from_share:
        return from_share[0], from_share[1], short_url

    resolved = resolve_short_link(short_url, cookie)
    resolved_ids = extract_shop_item_from_url(resolved)
    if not resolved_ids:
        raise RuntimeError("Cannot extract shopid/itemid from resolved link")
    return resolved_ids[0], resolved_ids[1], resolved


def get_variants(shopid: str, itemid: str, cookie: str) -> Tuple[str, List[ProductVariant]]:
    url = f"https://shopee.vn/api/v4/item/get?itemid={itemid}&shopid={shopid}"
    print(f"[*] Dang tai du lieu san pham tu API...")
    
    headers = {
        "Host": "shopee.vn",
        "Cookie": cookie,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Android app Shopee appver=28320 app_type=1",
    }
    
    status, payload = request_json(url, method="GET", headers=headers)
    
    if status != 200:
        raise RuntimeError(f"Loi lay du lieu san pham HTTP {status}: {payload}")
        
    if payload.get("error") not in (None, 0):
        raise RuntimeError(f"Shopee error: {payload.get('error_msg') or payload.get('error')}")
        
    data = payload.get("data") or {}
    product_name = data.get("name") or "San pham"
    models = data.get("models") or []
    
    variants: List[ProductVariant] = []

    for item in models:
        modelid = item.get("modelid")
        if modelid is None:
            continue
        
        model_name = item.get("name") or "Phan loai"
        price = (item.get("price") or 0) // 100000
        
        stock_val = item.get("stock")
        if stock_val is None:
            stock_val = item.get("normal_stock") or 0
        has_stock = int(stock_val) > 0
        
        variants.append(ProductVariant(
            modelid=int(modelid),
            model_name=str(model_name),
            item_name=str(product_name),
            price=price,
            has_stock=bool(has_stock)
        ))

    if not variants:
        stock_val = data.get("stock")
        if stock_val is None:
            stock_val = data.get("normal_stock") or 0
        has_stock = int(stock_val) > 0
        price = (data.get("price") or data.get("price_min") or 0) // 100000
        
        variants.append(ProductVariant(
            modelid=0, 
            model_name="Mac dinh", 
            item_name=product_name,
            price=price,
            has_stock=bool(has_stock)
        ))

    ordered = sorted(variants, key=lambda x: x.modelid)
    return product_name, ordered


def add_to_cart(
    cookie: str,
    shopid: str,
    itemid: str,
    modelid: int,
    quantity: int,
) -> Dict[str, Any]:
    body = {
        "quantity": quantity,
        "checkout": True,
        "update_checkout_only": False,
        "donot_add_quantity": False,
        "source": '{"refer_urls":[]}',
        "client_source": 1,
        "shopid": int(shopid),
        "itemid": int(itemid),
        "modelid": int(modelid),
        "cart_client_id": 1,
    }

    status, payload = request_json(
        ADD_TO_CART_URL,
        method="POST",
        headers={
            "Host": "shopee.vn",
            "Accept": "application/json",
            "Cookie": cookie,
            "Content-Type": "application/json",
            "User-Agent": "Android app Shopee appver=28320 app_type=1",
        },
        payload=body,
    )

    if status != 200:
        raise RuntimeError(f"add_to_cart HTTP {status}: {payload}")

    if payload.get("error") not in (None, 0):
        raise RuntimeError(payload.get("error_msg") or f"Shopee error: {payload.get('error')}")

    return payload


def choose_variant(variants: List[ProductVariant]) -> ProductVariant:
    print("\nDanh sach phan loai:")
    for idx, variant in enumerate(variants, start=1):
        stock_str = "Con hang" if variant.has_stock else "Het hang"
        price_str = f"{variant.price:,}đ" if variant.price > 0 else "N/A"
        print(f"{idx:<2}. {variant.model_name:<20} | Gia: {price_str:<12} | {stock_str:<10} | {variant.modelid}")

    while True:
        value = input("Chon so thu tu san pham can add: ").strip()
        if not value.isdigit():
            print("Vui long nhap so hop le")
            continue
        index = int(value)
        if 1 <= index <= len(variants):
            return variants[index - 1]
        print("Lua chon ngoai pham vi")


def choose_quantity() -> int:
    while True:
        value = input("Nhap so luong can add: ").strip()
        if not value.isdigit():
            print("Vui long nhap so nguyen duong")
            continue
        qty = int(value)
        if qty <= 0:
            print("So luong phai > 0")
            continue
        return qty


def main() -> int:
    try:
        print("=== SHOPEE CART ADD DIRECT ===")
        spc_st_input = input("Nhap cookie SPC_ST (co the nhap ca SPC_ST=...): ").strip()
        cookie = normalize_spc_st(spc_st_input)
        if not cookie:
            print("Cookie SPC_ST khong hop le", file=sys.stderr)
            return 1

        product_link = input("Nhap link san pham Shopee: ").strip()
        if not product_link:
            print("Ban chua nhap link", file=sys.stderr)
            return 1

        shopid, itemid, resolved_link = parse_product_link(product_link, cookie)
        print("\nDa phan tich link:")
        print(f"- shopid: {shopid}")
        print(f"- itemid: {itemid}")
        print(f"- resolved: {resolved_link}")

        product_name, variants = get_variants(shopid, itemid, cookie)
        print(f"\nTen san pham: {product_name}")

        selected = choose_variant(variants)
        quantity = choose_quantity()

        print("\nDang add vao gio hang...")
        result = add_to_cart(
            cookie=cookie,
            shopid=shopid,
            itemid=itemid,
            modelid=selected.modelid,
            quantity=quantity,
        )

        print("ADD TO CART THANH CONG")
        print(json.dumps({
            "shopid": shopid,
            "itemid": itemid,
            "modelid": selected.modelid,
            "model_name": selected.model_name,
            "quantity": quantity,
            "response": result,
        }, ensure_ascii=False, indent=2))
        return 0
    except Exception as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
