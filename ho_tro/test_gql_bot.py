import requests
import json
import urllib.parse
spc_st = "TnN6bW5YY2hvdnhQYW15U4Amoi/MrlAgwBIvOBvDyzqhREuY9xYNtz5i5KIwHdTgqtO0dwX6U6e/Va51hhD4qG2zRiSFtELdDlEujhtQToBs6BodqN81Tb2tQ0CqirRz5r6/BmlCQM6aj0weH4uDYivF7yRtFU0Luat3TLAKyGm/hejy/mhb/tN/AqQiSTcAa/GPQHdlFAFV21ZV9yHCgZHAdte/LV0LRUp5vyE1fJFxD31M93CogOUOdDPAmyzc.AKF3AZRuTa86NCxvEkeqmwyN6lqt3buL1Wzwc8iJiviQ"

url = "https://affiliate.shopee.vn/api/v3/gql?q=batchCustomLink"
payload = {
    "operationName": "batchGetCustomLink",
    "query": "query batchGetCustomLink($linkParams: [CustomLinkParam!], $sourceCaller: SourceCaller){\n      batchCustomLink(linkParams: $linkParams, sourceCaller: $sourceCaller){\n        shortLink\n        longLink\n        failCode\n      }\n    }\n    ",
    "variables": {
        "linkParams": [{"originalLink": "https://shopee.vn/product/449047668/24109867419"}],
        "sourceCaller": "CUSTOM_LINK_CALLER"
    }
}
import random, string
random_csrf = ''.join(random.choices(string.ascii_letters + string.digits, k=32))
headers = {
    "accept": "application/json, text/plain, */*",
    "content-type": "application/json; charset=UTF-8",
    "cookie": f"SPC_ST={spc_st}; csrftoken={random_csrf}",
    "csrf-token": random_csrf,
    "user-agent": "Android app Shopee appver=28320 app_type=1"
}
r = requests.post(url, headers=headers, json=payload)
print(r.text)
