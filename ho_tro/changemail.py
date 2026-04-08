import requests
import random
import string
import base64
import os

BASE_URL = "https://mall.shopee.vn"


# ===== RANDOM FINGERPRINT =====
def random_base64(n=32):
    return base64.b64encode(os.urandom(n)).decode()


def random_str(n=16):
    return ''.join(random.choices(string.ascii_letters + string.digits, k=n))


def generate_fingerprint():
    part1 = random_base64(16)
    part2 = random_base64(64)
    part3 = random_str(16)
    part4 = str(random.randint(1, 99)).zfill(2)
    part5 = str(random.randint(1, 5))

    return f"{part1}|{part2}|{part3}|{part4}|{part5}"


# ===== PROXY =====
def build_proxy(proxy_raw):
    proxy_raw = proxy_raw.strip()

    if not proxy_raw:
        return None

    # nếu chưa có http:// thì thêm vào
    if not proxy_raw.startswith("http"):
        proxy_raw = "http://" + proxy_raw

    return {
        "http": proxy_raw,
        "https": proxy_raw
    }


# ===== CLEAN COOKIE =====
def clean_spc_st(raw_input):
    raw_input = raw_input.strip()

    if raw_input.startswith("SPC_ST="):
        return raw_input.split("SPC_ST=", 1)[1]

    if "SPC_ST=" in raw_input:
        parts = raw_input.split(";")
        for part in parts:
            part = part.strip()
            if part.startswith("SPC_ST="):
                return part.split("SPC_ST=", 1)[1]

    return raw_input


# ===== HEADERS =====
def get_headers(spc_st):
    return {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Api-Source": "rn",
        "User-Agent": "iOS app iPhone Shopee appver=37036 language=vi app_type=1 platform=native_ios os_ver=26.3.1 Cronet/102.0.5005.61",
        "Cookie": f"SPC_ST={spc_st}"
    }


# ===== SAFE REQUEST =====
def safe_post(url, headers, payload, proxies=None):
    try:
        res = requests.post(
            url,
            headers=headers,
            json=payload,
            timeout=15,
            proxies=proxies
        )
        try:
            return res.json()
        except:
            print("❌ Response không phải JSON:")
            print(res.text)
            return None
    except Exception as e:
        print("❌ Lỗi request:", e)
        return None


# ===== STEP 1 =====
def change_email_init(spc_st, fingerprint, proxies):
    url = BASE_URL + "/api/v4/account/management/change_email_init"
    payload = {
        "client_info": {
            "identifier": {
                "security_device_fingerprint": fingerprint
            }
        }
    }

    data = safe_post(url, get_headers(spc_st), payload, proxies)
    if not data:
        return None

    token = data.get("data", {}).get("change_email_token")

    if not token:
        print("❌ Step 1 lỗi:", data)
        return None

    print("[1] change_email_token:", token)
    return token


# ===== STEP 2 =====
def init_email_otp(spc_st, email, fingerprint, proxies):
    url = BASE_URL + "/api/v4/otp/init_email_otp"
    payload = {
        "email": email,
        "operation": 24,
        "support_session": True,
        "client_identifier": {
            "security_device_fingerprint": fingerprint
        }
    }

    data = safe_post(url, get_headers(spc_st), payload, proxies)
    print("[2] init_email_otp:", data)


# ===== STEP 3 =====
def send_email_otp(spc_st, email, fingerprint, proxies):
    url = BASE_URL + "/api/v4/otp/send_email_otp"
    payload = {
        "email": email,
        "operation": 24,
        "encrypted_email": "",
        "captcha_signature": "",
        "seed": "",
        "first_otp": True,
        "support_session": True,
        "client_identifier": {
            "security_device_fingerprint": fingerprint
        }
    }

    data = safe_post(url, get_headers(spc_st), payload, proxies)
    if not data:
        return None

    seed = data.get("data", {}).get("session_info", {}).get("seed")

    if not seed:
        print("❌ Step 3 lỗi:", data)
        return None

    print("[3] seed:", seed)
    return seed


# ===== STEP 4 =====
def verify_email_otp(spc_st, email, otp, seed, fingerprint, proxies):
    url = BASE_URL + "/api/v4/otp/verify_email_otp"
    payload = {
        "otp": otp,
        "operation": 24,
        "email": email,
        "encrypted_email": "",
        "seed": seed,
        "support_session": True,
        "client_identifier": {
            "security_device_fingerprint": fingerprint
        }
    }

    data = safe_post(url, get_headers(spc_st), payload, proxies)
    if not data:
        return None

    token = data.get("data", {}).get("email_otp_token")

    if not token:
        print("❌ Step 4 lỗi:", data)
        return None

    print("[4] email_otp_token:", token)

    with open("email_otp_token.txt", "w") as f:
        f.write(token)

    return token


# ===== STEP 5 =====
def change_email_commit(spc_st, change_email_token, email, email_otp_token, fingerprint, proxies):
    url = BASE_URL + "/api/v4/account/management/change_email_commit"

    payload = {
        "change_email_token": change_email_token,
        "new_email": email,
        "email_otp_token": email_otp_token,
        "ivs_signature": None,
        "ivs_method": None,
        "subscribe_newsletter": True,
        "client_info": {
            "identifier": {
                "security_device_fingerprint": fingerprint
            }
        }
    }

    data = safe_post(url, get_headers(spc_st), payload, proxies)
    if not data:
        return

    if data.get("error") == 0:
        print("[5] ✅ ĐỔI EMAIL THÀNH CÔNG!")
    else:
        print("[5] ❌ Thất bại:", data)


# ===== MAIN =====
if __name__ == "__main__":
    raw = input("Nhập SPC_ST: ")
    spc_st = clean_spc_st(raw)

    proxy_input = input("Nhập proxy (ip:port hoặc user:pass@ip:port, bỏ trống nếu không): ")
    proxies = build_proxy(proxy_input)

    email = input("Nhập email mới: ").strip()

    fingerprint = generate_fingerprint()
    print("Fingerprint:", fingerprint)

    # STEP 1
    change_token = change_email_init(spc_st, fingerprint, proxies)
    if not change_token:
        exit()

    # STEP 2
    init_email_otp(spc_st, email, fingerprint, proxies)

    # STEP 3
    seed = send_email_otp(spc_st, email, fingerprint, proxies)
    if not seed:
        exit()

    otp = input("Nhập OTP: ").strip()

    # STEP 4
    email_token = verify_email_otp(spc_st, email, otp, seed, fingerprint, proxies)
    if not email_token:
        exit()

    # STEP 5
    change_email_commit(spc_st, change_token, email, email_token, fingerprint, proxies)

    print("\n=== DONE ===")