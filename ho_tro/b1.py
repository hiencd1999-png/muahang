import asyncio
import random
from playwright.async_api import async_playwright
from playwright_stealth import Stealth

def mask_username(u):
    if not u or len(u) < 2:
        return u
    return u[0] + "*****" + u[-1]

async def human_behavior(page):
    await page.mouse.move(random.randint(100, 400), random.randint(100, 400))
    await page.mouse.move(random.randint(400, 800), random.randint(200, 600))
    await asyncio.sleep(random.uniform(0.5, 1.5))

# ===== CORE LOGIC MỚI =====
def check_recoverable(status, msg, masked_phone, masked_email, portrait, d2_error):
    # 1. Có mask => chuẩn chỉ lấy lại được
    if masked_phone or masked_email:
        return True

    # 2. Status = 1 (Live) => chắc chắn có thể sử dụng/lấy lại
    if status == 1:
        return True

    # 3. F02 nhưng có tín hiệu sống
    if status == 2 and msg and "F02" in msg:
        if portrait:
            return True
        if d2_error == 3:
            return True
        return False

    return False


async def main():
    async with Stealth().use_async(async_playwright()) as p:
        browser = await p.chromium.launch(headless=False)

        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            viewport={'width': 1280, 'height': 720},
            locale="vi-VN"
        )

        page = await context.new_page()

        print("\n🚀 Khởi động...")
        await page.goto("https://shopee.vn/", wait_until="domcontentloaded")

        await human_behavior(page)
        await asyncio.sleep(random.uniform(1, 2))

        print("✅ Sẵn sàng!\n")

        scan_count = 0

        while True:
            if scan_count >= 8:
                print("🔄 Reload chống bot...")
                await page.reload(wait_until="domcontentloaded")
                await human_behavior(page)
                await asyncio.sleep(random.uniform(2, 3))
                scan_count = 0

            user_input = input("\n👉 Nhập ('q' để thoát): ").strip()

            if user_input.lower() == 'q':
                break
            if not user_input:
                continue

            scan_count += 1

            phone_val = ""
            user_val = ""

            if user_input.isdigit():
                phone_val = "84" + user_input[1:] if user_input.startswith("0") else user_input
            else:
                user_val = user_input

            print(f"🔄 Đang check (Native ByPass Mode): {user_input}...")

            try:
                api = await asyncio.wait_for(
                    page.evaluate(
                        '''async (p) => {
                            try {
                                const csrf = document.cookie.split('; ').find(r => r.startsWith('csrftoken='));
                                const token = csrf ? csrf.split('=')[1] : '';

                                const headers = {
                                    'Content-Type': 'application/json',
                                    'Accept': 'application/json',
                                    'X-Csrftoken': token,
                                    'x-api-source': 'pc',
                                    'x-requested-with': 'XMLHttpRequest',
                                    'x-shopee-language': 'vi'
                                };

                                let r = {step1:null, step2:null};

                                const c1 = new AbortController();
                                const t1 = setTimeout(() => c1.abort(), 8000);

                                const res1 = await fetch('https://shopee.vn/api/v4/account/basic/check_account_exist',{
                                    method:'POST',
                                    headers,
                                    signal: c1.signal,
                                    body:JSON.stringify({
                                        username:p.username,
                                        phone:p.phone,
                                        scenario:3
                                    })
                                });
                                clearTimeout(t1);

                                const d1 = JSON.parse(await res1.text());
                                r.step1 = d1;

                                if(d1.data && d1.data.exist && d1.data.acct_nonce){
                                    const c2 = new AbortController();
                                    const t2 = setTimeout(() => c2.abort(), 5000);

                                    // ===== ĐIỂM QUYẾT ĐỊNH: Bơm body chuẩn của Shopee Mobile App =====
                                    const res2 = await fetch('https://shopee.vn/api/v4/account/get_user_login_methods',{
                                        method:'POST',
                                        headers,
                                        signal: c2.signal,
                                        body:JSON.stringify({
                                            acct_nonce: d1.data.acct_nonce,
                                            support_login_methods: [1,2,4,5,7,9,11,12,13,14],
                                            client_info: {
                                                device_model: "iPhone13,3"
                                            }
                                        })
                                    });
                                    clearTimeout(t2);

                                    r.step2 = JSON.parse(await res2.text());
                                }

                                return r;

                            } catch(e){
                                return {error:e.toString()}
                            }
                        }''',
                        {"phone": phone_val, "username": user_val}
                    ),
                    timeout=15
                )

            except asyncio.TimeoutError:
                print("⚠️ Timeout → nghi bot (Cử động tí/Giải Capcha nếu báo dính)")
                scan_count = 8
                continue

            print("\n" + "="*35)
            print(f"🍀 Results: {phone_val or user_val}")

            if not api or api.get("error"):
                print("⚠️ Lỗi request")
                continue

            d1 = api.get("step1", {})
            d2 = api.get("step2", {})

            if d1.get("error") != 0:
                print(f"⚠️ Shopee từ chối D1: {d1.get('error')}")
                continue

            data = d1.get("data", {})

            if not data.get("exist"):
                print("🧼 Số chưa liên kết Shopee")
                print("="*35)
                continue

            user = data.get("user", {})
            status = user.get("status")
            username = mask_username(user.get("username"))
            portrait = user.get("portrait")
            msg = data.get("account_banned_msg")

            masked_phone = None
            masked_email = None

            # D1 scan
            masked_phone = data.get("phone") or user.get("phone")
            masked_email = data.get("email") or user.get("email")

            # D2 scan
            d2_error = d2.get("error")
            if d2_error == 0:
                detail = d2.get("data", {})
                if detail:
                    phone_val = detail.get("masked_phone") or detail.get("phone")
                    email_val = detail.get("masked_email") or detail.get("email")
                    # Gán đè nếu Tool kéo được mask thật thay vì chuỗi rỗng
                    if phone_val and len(phone_val) > 2: masked_phone = phone_val
                    if email_val and len(email_val) > 2: masked_email = email_val

            # ===== APPLY LOGIC MỚI LỌC SỐ =====
            is_recoverable = check_recoverable(
                status, msg, masked_phone, masked_email, portrait, d2_error
            )

            # ===== OUTPUT =====
            if status == 1:
                print("✅ Đã liên kết Shopee")
                print("🟡 Lấy lại được" if is_recoverable else "🔴 Không lấy lại được/Thiếu mask")

            elif status == 2:
                print("❌ Bị khóa (F02)")
                print("🟡 Lấy lại được" if is_recoverable else "🔴 Không lấy lại được")

            if username:
                print(f"👤 Username: {username}")
            if masked_phone:
                print(f"📞 SĐT: {masked_phone}")
            if masked_email:
                print(f"✉️ Email: {masked_email}")

            print("="*35)

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
