import re
import urllib.parse
import requests
import telebot
import json

TOKEN = '8438915216:AAHztUIypRr1DOvInQX5VP5qJqLWhl6UdEU'

bot = telebot.TeleBot(TOKEN)

# Biến lưu trữ SPC_ST (có thể cập nhật qua tin nhắn)
current_spc_st = None

def is_shopee_link(text):
    return 'shopee.vn' in text or 'shp.ee' in text

def expand(url):
    try:
        res = requests.get(url, timeout=5, allow_redirects=True)
        return res.url if res.url else url
    except Exception:
        return url

def extract_shop_item(url_str):
    patterns = [
        r"shopee\.vn/.*?-i\.(\d+)\.(\d+)",
        r"shopee\.vn/[^/]+/(\d+)\.(\d+)",
        r"shopee\.vn/product/(\d+)/(\d+)",
        r"shopee\.vn/[^/]+/(\d+)/(\d+)"
    ]
    for p in patterns:
        match = re.search(p, url_str)
        if match:
            return match.group(1), match.group(2)
    return None

def generate_short_link_gql(original_link, spc_st):
    url = "https://affiliate.shopee.vn/api/v3/gql?q=batchCustomLink"
    payload = {
        "operationName": "batchGetCustomLink",
        "query": "query batchGetCustomLink($linkParams: [CustomLinkParam!], $sourceCaller: SourceCaller){\n      batchCustomLink(linkParams: $linkParams, sourceCaller: $sourceCaller){\n        shortLink\n        longLink\n        failCode\n      }\n    }\n    ",
        "variables": {
            "linkParams": [{"originalLink": original_link}],
            "sourceCaller": "CUSTOM_LINK_CALLER"
        }
    }
    
    import random
    import string
    
    random_csrf = ''.join(random.choices(string.ascii_letters + string.digits, k=32))
    
    headers = {
        "accept": "application/json, text/plain, */*",
        "content-type": "application/json; charset=UTF-8",
        "cookie": f"SPC_ST={spc_st}; csrftoken={random_csrf}",
        "csrf-token": random_csrf,
        "user-agent": "Android app Shopee appver=28320 app_type=1"
    }
    
    try:
        res = requests.post(url, headers=headers, json=payload, timeout=10)
        data = res.json()
        
        # Nếu Shopee văng lỗi auth/WAF block sẽ nằm trong failCode hoặc data=None
        short_link = data["data"]["batchCustomLink"][0]["shortLink"]
        if short_link:
            return short_link, None
    except Exception as e:
        error_msg = f"Lỗi gọi API Shopee: {str(e)[:50]}"
        try:
            if res: error_msg = res.text[:200]
        except: pass
        return original_link, error_msg
        
    return original_link, "Lỗi phản hồi hệ thống (Có thể do mã bảo mật WAF hết hạn)"

@bot.message_handler(func=lambda message: True)
def handle_message(message):
    global current_spc_st
    chat_id = message.chat.id
    text = message.text

    if not text or not is_shopee_link(text):
        bot.send_message(chat_id, 'Vui lòng gửi link Shopee hợp lệ')
        return
    if not current_spc_st:
        bot.send_message(chat_id, "⚠️ Bot chưa đưọc nạp SPC_ST từ Console! Hãy khởi động lại script.")
        return

    bot.send_message(chat_id, '⏳ Đang xử lý lấy link Affiliate...')

    try:
        if 's.shopee.vn' in text or 'shp.ee' in text:
            text = expand(text)

        clean_long_url = text
        extracted = extract_shop_item(text)
        
        if extracted:
            shop_id, item_id = extracted
            clean_long_url = f"https://shopee.vn/product/{shop_id}/{item_id}"
        else:
            parsed = urllib.parse.urlparse(clean_long_url)
            clean_long_url = urllib.parse.urlunparse(parsed._replace(query=""))

        # Gọi GraphQL tạo link rút gọn theo cookie SPC_ST đã cài
        short_url, err = generate_short_link_gql(clean_long_url, current_spc_st)

        if err:
            bot.send_message(chat_id, f"❌ Không thể rút gọn link!\nLý do: {err}")
        else:
            bot.send_message(chat_id, f"✅ Link Affiliate của bạn:\n{short_url}")

    except Exception as e:
        print(f"Error handling message: {e}")
        bot.send_message(chat_id, '❌ Thao tác lỗi nội bộ')

if __name__ == "__main__":
    print("=== SHOPEE AFFILIATE BOT ===")
    user_input = input("Nhập cookie SPC_ST (từ web affiliate.shopee.vn): ").strip()
    
    if user_input.startswith("SPC_ST="):
        user_input = user_input.replace("SPC_ST=", "")
        
    current_spc_st = user_input
    if not current_spc_st:
        print("Lỗi: Bạn chưa nhập SPC_ST! Tắt script...")
        exit(1)
        
    print("\n✅ Đã nạp thành công SPC_ST. Bot đang chờ tin nhắn Telegram...")
    bot.infinity_polling()
