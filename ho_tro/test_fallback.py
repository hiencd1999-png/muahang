import requests

encoded = 'https%3A%2F%2Fshopee.vn%2Fproduct%2F449047668%2F24109867419%3Faf_siteid%3D17329290385'
fallbackUrl = f'https://mall.shopee.vn/api/v4/generic_sharing/get_sharing_link_for_non_affiliate?url={encoded}'
fallbackHeaders = {
    "User-Agent": "Android app Shopee appver=28320 app_type=1"
}
r = requests.get(fallbackUrl, headers=fallbackHeaders)
print(r.text)
