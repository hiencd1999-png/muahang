import json
from playwright.sync_api import sync_playwright

def add_to_cart_playwright(cookie_string: str, shopid: int, itemid: int, modelid: int, quantity: int):
    cookies = []
    # Kể cả bạn chỉ có SPC_ST, code này vẫn nạp vào. Shopee sẽ tự sinh _sapid và các cookie phụ khác.
    for c in cookie_string.split(';'):
        if '=' in c:
            k, v = c.strip().split('=', 1)
            cookies.append({
                "name": k,
                "value": v,
                "domain": ".shopee.vn",
                "path": "/"
            })

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 720}
        )
        context.add_cookies(cookies)

        page = context.new_page()
        page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

        # Cài bộ lắng nghe: Nếu thấy request add_to_cart, Bắt và in ra TẤT CẢ các header ẩn bị mã hoá
        page.on("request", lambda req: 
            print("\n[+] BẮT ĐƯỢC GIÁN ĐIỆP GỬI ĐI TỪ PLAYWRIGHT:\n", 
                  json.dumps(req.headers, indent=2)) if "api/v4/cart/add_to_cart" in req.url else None
        )

        print("[*] Đang vào trang Shopee để sinh các trường bảo mật còn thiếu...")
        page.goto(f"https://shopee.vn/product/{shopid}/{itemid}", wait_until="networkidle", timeout=30000)

        # QUAN TRỌNG: TRÁNH MÃ 90309999
        print("\n!!! CHÚ Ý TRÊN MÀN HÌNH TRÌNH DUYỆT !!!")
        print("- Nếu Shopee yêu cầu kéo MẢNH GHÉP CAPTCHA, hãy dùng chuột kéo cho qua.")
        print("- Nếu không có gì, hãy cứ ấn nút Enter bên dưới để tiếp tục.")
        input(">>> BẤM ENTER NHẸ Ở ĐÂY SAU KHI ĐÃ SẴN SÀNG <<< ")

        # Lấy X-CSRF-Token mới nhất do trang vừa tự sinh
        current_cookies = context.cookies()
        csrf_token = next((c['value'] for c in current_cookies if c['name'] == 'csrftoken'), "")

        print(f"[*] CsrfToken hiện tại: {csrf_token}")
        print("[*] Đang tiến hành thực hện lệnh Add_To_Cart ngầm...")

        # Đẩy file
        add_result = page.evaluate("""
            async ([shopid, itemid, modelid, quantity, csrf_token]) => {
                const body = {
                    "quantity": quantity,
                    "checkout": true,
                    "update_checkout_only": false,
                    "donot_add_quantity": false,
                    "source": '{"refer_urls":[]}',
                    "client_source": 1,
                    "shopid": shopid,
                    "itemid": itemid,
                    "modelid": modelid,
                    "cart_client_id": 1,
                };

                const res = await fetch('/api/v4/cart/add_to_cart', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-Csrftoken': csrf_token,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: JSON.stringify(body)
                });
                return await res.json();
            }
        """, [shopid, itemid, modelid, quantity, csrf_token])

        print("\n=> API TRẢ VỀ KẾT QUẢ CUỐI CÙNG:", add_result)
        browser.close()
        return add_result

if __name__ == "__main__":
    # Chỉ chứa mỗi SPC_ST của bạn:
    cookie_str = "SPC_ST=U082VXBMUXpjaHRpRkY0b2WOwVSJDsuMiejXXri1xlvXic/cgMg9S/gTJn3lhCGP+G6GCF+5/e/jgnqFUZJeLd2c2APgOycXvtFtc8uMKwqUd2wWVqhbEZJiW7Vc2YleHxOwXq4SoVK8NRI0gAB0O957KYBBDnRqWFlmp+nDxp0LBrzgbA3iY1EpEGoChcDEVtduwnCLkAM9UUxYYueA/HLeJvn1b0ban/iBKU/xNTT7tGpTlnPwaY38XOmpnuD2.ABPjkX8ikcbOkU1qJGoH47Dh0Ys29vAu5+YDYuTVOdi7;"
    
    shopid = 1115625097
    itemid = 25115498959
    modelid = 350066461462
    quantity = 1

    add_to_cart_playwright(cookie_str, shopid, itemid, modelid, quantity)
