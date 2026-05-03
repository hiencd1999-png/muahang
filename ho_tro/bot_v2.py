import re
import urllib.parse
import requests
import telebot
import json

TOKEN = '8438915216:AAHztUIypRr1DOvInQX5VP5qJqLWhl6UdEU'

bot = telebot.TeleBot(TOKEN)

# Biến lưu trữ danh sách SPC_ST
spc_st_list = []

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

def generate_short_link_gql(original_link, spc_st, sub_id=None):
    url = "https://affiliate.shopee.vn/api/v3/gql?q=batchCustomLink"
    
    link_param = {"originalLink": original_link}
    if sub_id:
        link_param["advancedLinkParams"] = {"subId1": sub_id}
        
    payload = {
        "operationName": "batchGetCustomLink",
        "query": "query batchGetCustomLink($linkParams: [CustomLinkParam!], $sourceCaller: SourceCaller){\n      batchCustomLink(linkParams: $linkParams, sourceCaller: $sourceCaller){\n        shortLink\n        longLink\n        failCode\n      }\n    }\n    ",
        "variables": {
            "linkParams": [link_param],
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

@bot.message_handler(commands=['start', 'help'])
def send_welcome(message):
    instructions = (
        "👋 Chào mừng bạn đến với Bot tạo link Affiliate Shopee!\n\n"
        "📖 **Cách sử dụng:**\n"
        "1. Tạo link cơ bản: Gửi một đường link Shopee bất kỳ.\n"
        "   👉 `https://shopee.vn/...`\n\n"
        "2. Tạo link kèm SubID: Gửi link Shopee cách một khoảng trắng rồi đến SubID.\n"
        "   👉 `https://shopee.vn/... OtisTX`\n\n"
        "⚠️ Bot hỗ trợ phân giải đủ các định dạng rút gọn như s.shopee.vn hay shp.ee"
    )
    bot.reply_to(message, instructions, parse_mode='Markdown')

@bot.message_handler(func=lambda message: True)
def handle_message(message):
    global spc_st_list
    chat_id = message.chat.id
    text = message.text

    if not text:
        return
        
    parts = text.split()
    link_text = parts[0]
    sub_id = parts[1] if len(parts) > 1 else None

    if not is_shopee_link(link_text):
        bot.send_message(chat_id, 'Vui lòng gửi link Shopee hợp lệ (Cú pháp: <link> <subid - tùy chọn>)')
        return
    if not spc_st_list:
        bot.send_message(chat_id, "⚠️ Bot chưa đưọc nạp SPC_ST từ Console! Hãy khởi động lại script.")
        return

    bot.send_message(chat_id, '⏳ Đang xử lý lấy link Affiliate...')

    try:
        if 's.shopee.vn' in link_text or 'shp.ee' in link_text:
            link_text = expand(link_text)

        clean_long_url = link_text
        extracted = extract_shop_item(link_text)
        
        if extracted:
            shop_id, item_id = extracted
            clean_long_url = f"https://shopee.vn/product/{shop_id}/{item_id}"
        else:
            parsed = urllib.parse.urlparse(clean_long_url)
            clean_long_url = urllib.parse.urlunparse(parsed._replace(query=""))

        import random
        # Chọn ngẫu nhiên 1 cookie từ danh sách để chia đều tỷ lệ sử dụng
        selected_spc_st = random.choice(spc_st_list)
        # Gọi GraphQL tạo link rút gọn theo cookie SPC_ST đã chọn
        short_url, err = generate_short_link_gql(clean_long_url, selected_spc_st, sub_id)

        if err:
            bot.send_message(chat_id, f"❌ Không thể rút gọn link!\nLý do: {err}")
        else:
            bot.send_message(chat_id, f"✅ Link Affiliate của bạn:\n{short_url}")

    except Exception as e:
        print(f"Error handling message: {e}")
        bot.send_message(chat_id, '❌ Thao tác lỗi nội bộ')

if __name__ == "__main__":
    print("=== SHOPEE AFFILIATE BOT ===")
    import os
    
    spc_st_list = []
    if os.path.exists("cookie.txt"):
        with open("cookie.txt", "r", encoding="utf-8") as f:
            for line in f:
                c = line.strip()
                if c.startswith("SPC_ST="):
                    c = c.replace("SPC_ST=", "")
                if c:
                    spc_st_list.append(c)
    else:
        print("Lỗi: Không tìm thấy file cookie.txt! Vui lòng tạo file và thêm cookie.")
        exit(1)
            
    if not spc_st_list:
        print("Lỗi: Bạn chưa nhập SPC_ST nào! Tắt script...")
        exit(1)
        
    print(f"\n✅ Đã nạp thành công {len(spc_st_list)} cookie SPC_ST. Bot đang chờ tin nhắn Telegram...")
    bot.infinity_polling()
