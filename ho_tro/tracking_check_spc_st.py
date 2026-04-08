import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from typing import Any


TRACKING_STATUS_MAP = {
    "label_preparing_order": "Dang chuan bi don hang",
    "preparing_order": "Dang chuan bi don hang",
    "label_order_prepared": "Don hang da san sang",
    "order_prepared": "Don hang da san sang",
    "label_to_ship": "Cho gui hang",
    "to_ship": "Cho gui hang",
    "label_to_receive": "Dang giao",
    "to_receive": "Dang giao",
    "order_list_text_to_ship_edt": "Cho gui hang",
    "order_status_text_to_ship_order_edt_cod": "Cho gui hang (COD)",
    "order_status_text_to_ship_order_edt": "Cho gui hang",
    "label_waiting_pickup": "Cho lay hang",
    "waiting_pickup": "Cho lay hang",
    "label_pickup_scheduled": "Da len lich lay hang",
    "pickup_scheduled": "Da len lich lay hang",
    "label_in_transit": "Dang van chuyen",
    "in_transit": "Dang van chuyen",
    "label_on_the_way": "Dang tren duong giao",
    "on_the_way": "Dang tren duong giao",
    "label_out_for_delivery": "Dang giao hang",
    "out_for_delivery": "Dang giao hang",
    "label_delivered": "Da giao hang",
    "delivered": "Da giao hang",
    "label_delivery_confirmed": "Da xac nhan giao hang",
    "delivery_confirmed": "Da xac nhan giao hang",
    "label_completed": "Hoan thanh",
    "completed": "Hoan thanh",
    "label_order_completed": "Don hang hoan thanh",
    "order_completed": "Don hang hoan thanh",
    "label_cancelled": "Da huy",
    "cancelled": "Da huy",
    "label_order_cancelled": "Da huy",
    "order_cancelled": "Da huy",
    "label_cancel_order_reason_admin_901": "Huy boi he thong",
    "cancel_order_reason_admin_901": "Huy boi he thong",
    "label_return_requested": "Yeu cau hoan tra",
    "return_requested": "Yeu cau hoan tra",
    "label_returned": "Da hoan tra",
    "returned": "Da hoan tra",
    "label_refunded": "Da hoan tien",
    "refunded": "Da hoan tien",
    "label_pending_payment": "Cho thanh toan",
    "pending_payment": "Cho thanh toan",
    "label_payment_failed": "Thanh toan that bai",
    "payment_failed": "Thanh toan that bai",
    "label_processing": "Dang xu ly",
    "processing": "Dang xu ly",
    "label_ship_by_date_not_calculated": "Dang xu ly",
    "ship_by_date_not_calculated": "Dang xu ly",
    "label_confirmed": "Da xac nhan",
    "confirmed": "Da xac nhan",
    "label_delivery_failed": "Giao hang that bai",
    "delivery_failed": "Giao hang that bai",
    "label_delivery_attempted": "Da thu giao hang",
    "delivery_attempted": "Da thu giao hang",
    "label_delivery_delayed": "Giao hang bi tre",
    "delivery_delayed": "Giao hang bi tre",
    "label_arrived_at_warehouse": "Da den kho",
    "arrived_at_warehouse": "Da den kho",
    "label_left_warehouse": "Da roi kho",
    "left_warehouse": "Da roi kho",
    "label_at_sorting_center": "Dang tai trung tam phan loai",
    "at_sorting_center": "Dang tai trung tam phan loai",
}


def normalize_cookie(raw_cookie: str) -> str:
    value = raw_cookie.strip()
    if not value:
        raise ValueError("Empty cookie")
    return value if "SPC_ST=" in value else f"SPC_ST={value}"


def normalize_tracking_status(value: Any, fallback: str = "") -> str:
    if value is None:
        return fallback
    normalized = str(value).strip()
    if not normalized:
        return fallback

    direct_match = TRACKING_STATUS_MAP.get(normalized)
    if direct_match:
        return direct_match

    lower_value = normalized.lower()
    lower_match = TRACKING_STATUS_MAP.get(lower_value)
    if lower_match:
        return lower_match

    if lower_value.startswith("label_"):
        no_label = lower_value.removeprefix("label_")
        return TRACKING_STATUS_MAP.get(no_label, normalized)

    return normalized


def format_history_time(unix_seconds: Any) -> str:
    if not unix_seconds:
        return ""
    try:
        date_value = datetime.fromtimestamp(int(unix_seconds))
    except (TypeError, ValueError, OSError):
        return ""
    return date_value.strftime("%d/%m %H:%M")


def format_full_date(unix_seconds: Any) -> str:
    if not unix_seconds:
        return ""
    try:
        date_value = datetime.fromtimestamp(int(unix_seconds))
    except (TypeError, ValueError, OSError):
        return ""
    return date_value.strftime("%A, %d/%m/%Y")


@dataclass
class OrderSeed:
    order_id: str
    final_total: int
    cached_detail: dict[str, Any]


class ShopeeTrackingChecker:
    def __init__(self, spc_st_cookie: str, timeout: int = 15) -> None:
        self.cookie = normalize_cookie(spc_st_cookie)
        self.timeout = timeout

    def _request_json(
        self,
        url: str,
        *,
        host: str,
        referer: str,
        user_agent: str,
        extra_headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        headers = {
            "Host": host,
            "Cookie": self.cookie,
            "User-Agent": user_agent,
            "Accept": "*/*",
            "Referer": referer,
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        }
        if extra_headers:
            headers.update(extra_headers)

        request = urllib.request.Request(url, headers=headers, method="GET")

        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                body = response.read().decode("utf-8", errors="replace")
                status_code = response.getcode()
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            status_code = exc.code
            if status_code in (401, 403):
                raise RuntimeError("SPC_ST expired or invalid") from exc
            raise RuntimeError(f"HTTP {status_code}: {body[:300]}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Network error: {exc.reason}") from exc

        try:
            payload = json.loads(body)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Invalid JSON response: {body[:300]}") from exc

        error_code = payload.get("error")
        error_message = str(payload.get("error_msg") or "").strip()
        if error_code not in (None, 0):
            raise RuntimeError(f"Shopee error {error_code}: {error_message or 'unknown'}")

        lowered_message = error_message.lower()
        if any(token in lowered_message for token in ("authenticate", "invalid cookie", "please log in", "failed")):
            raise RuntimeError(f"Shopee rejected cookie: {error_message}")

        return payload

    def fetch_order_list(self, limit: int = 5, offset: int = 0) -> list[OrderSeed]:
        params = urllib.parse.urlencode({"limit": limit, "offset": offset})
        url = f"https://shopee.vn/api/v4/order/get_all_order_and_checkout_list?{params}"
        payload = self._request_json(
            url,
            host="shopee.vn",
            referer="https://shopee.vn/",
            user_agent="Android app Shopee appver=28320 app_type=1",
            extra_headers={
                "Content-Type": "application/json",
            },
        )

        orders_old = payload.get("data", {}).get("order_data", {}).get("details_list", []) or []
        orders_new = payload.get("new_data", {}).get("order_or_checkout_data", []) or []

        order_map: dict[str, OrderSeed] = {}

        for order in orders_old:
            info = (order or {}).get("info_card", {})
            order_id = info.get("order_id")
            if order_id:
                order_map[str(order_id)] = OrderSeed(
                    order_id=str(order_id),
                    final_total=int(info.get("final_total") or 0),
                    cached_detail=order,
                )

        for item in orders_new:
            detail = (item or {}).get("order_list_detail") or item or {}
            info = detail.get("info_card", {})
            order_id = info.get("order_id")
            if order_id:
                order_map[str(order_id)] = OrderSeed(
                    order_id=str(order_id),
                    final_total=int(info.get("final_total") or 0),
                    cached_detail=detail,
                )

        return list(order_map.values())

    def fetch_order_detail(self, order_id: str) -> dict[str, Any]:
        url = f"https://shopee.vn/api/v4/order/get_order_detail?_oft=0&order_id={urllib.parse.quote(order_id)}"
        payload = self._request_json(
            url,
            host="shopee.vn",
            referer="https://shopee.vn/",
            user_agent="Android app Shopee appver=28320 app_type=1",
            extra_headers={
                "Content-Type": "application/json",
                "X-Order-ID": order_id,
            },
        )
        return payload.get("data", {}) or {}

    def fetch_logistics(self, order_id: str) -> dict[str, Any] | None:
        url = f"https://mall.shopee.vn/api/v4/order/buyer/get_logistics_info?_oft=0&order_id={urllib.parse.quote(order_id)}"
        payload = self._request_json(
            url,
            host="mall.shopee.vn",
            referer="https://mall.shopee.vn/",
            user_agent=(
                "iOS app iPhone Shopee appver=36649 language=vi app_type=1 "
                "platform=native_ios os_ver=26.2.1 Cronet/102.0.5005.61"
            ),
            extra_headers={
                "X-Shopee-Client-Timezone": "Asia/Ho_Chi_Minh",
            },
        )

        data = payload.get("data")
        if not data:
            return None

        tracking_items = data.get("tracking_info_list") or []
        history = []
        for item in tracking_items:
            history.append(
                {
                    "ctime": item.get("ctime"),
                    "ctime_text": format_history_time(item.get("ctime")),
                    "description": normalize_tracking_status(item.get("description"), ""),
                    "pin_code": item.get("pin_code") or item.get("pinCode"),
                    "driver_phone": item.get("driver_phone") or "",
                    "driver_name": item.get("driver_name") or "",
                    "license_plate_number": item.get("license_plate_number") or "",
                }
            )

        carrier_name = data.get("carrier_name") or data.get("channel_name") or "Unknown"
        tracking_number = data.get("tracking_number") or ""
        expected_type = normalize_tracking_status(data.get("time_display", {}).get("type"), "Expected delivery")
        expected_text = format_full_date(data.get("time_display", {}).get("time"))

        summary_lines = [f"Carrier: {carrier_name}"]
        if tracking_number:
            summary_lines.append(f"Tracking number: {tracking_number}")
        if expected_text:
            summary_lines.append(f"{expected_type}: {expected_text}")

        for item in history:
            if item["ctime_text"]:
                summary_lines.append("")
                summary_lines.append(item["ctime_text"])
            if item["description"]:
                summary_lines.append(item["description"])

            detail_bits = []
            if item["pin_code"]:
                detail_bits.append(f"PIN: {item['pin_code']}")
            if item["driver_name"]:
                detail_bits.append(f"Driver: {item['driver_name']}")
            if item["driver_phone"]:
                detail_bits.append(f"Phone: {item['driver_phone']}")
            if item["license_plate_number"]:
                detail_bits.append(f"Plate: {item['license_plate_number']}")
            if detail_bits:
                summary_lines.append(" | ".join(detail_bits))

        return {
            "shipping_status": normalize_tracking_status(data.get("shipping_status"), ""),
            "shipping_status_raw": data.get("shipping_status_raw"),
            "carrier_name": carrier_name,
            "tracking_number": tracking_number,
            "expected_time_type": expected_type,
            "expected_time": data.get("time_display", {}).get("time"),
            "expected_time_text": expected_text,
            "history": history,
            "summary": "\n".join(summary_lines),
        }

    @staticmethod
    def _extract_order_time(detail_payload: dict[str, Any]) -> str:
        for row in detail_payload.get("processing_info", {}).get("info_rows", []) or []:
            if row.get("info_label", {}).get("text") == "label_odp_order_time":
                return row.get("info_value", {}).get("value") or ""
        return ""

    @staticmethod
    def _extract_first_item(detail_payload: dict[str, Any]) -> dict[str, Any]:
        parcel_cards = detail_payload.get("info_card", {}).get("parcel_cards", []) or []
        if parcel_cards:
            return (
                parcel_cards[0]
                .get("product_info", {})
                .get("item_groups", [{}])[0]
                .get("items", [{}])[0]
            ) or {}

        order_list_cards = detail_payload.get("info_card", {}).get("order_list_cards", []) or []
        if order_list_cards:
            parcel_cards = order_list_cards[0].get("parcel_cards", []) or []
            if parcel_cards:
                return (
                    parcel_cards[0]
                    .get("product_info", {})
                    .get("item_groups", [{}])[0]
                    .get("items", [{}])[0]
                ) or {}

        return (
            detail_payload.get("info_card", {})
            .get("product_info", {})
            .get("item_groups", [{}])[0]
            .get("items", [{}])[0]
        ) or {}

    def build_order_result(self, seed: OrderSeed) -> dict[str, Any]:
        detail_payload = self.fetch_order_detail(seed.order_id)

        shipping = detail_payload.get("shipping", {}) or {}
        tracking = shipping.get("tracking_info", {}) or {}
        delivery = shipping.get("delivery_info", {}) or {}
        address = detail_payload.get("address", {}) or {}
        item = self._extract_first_item(detail_payload)

        result = {
            "order_id": seed.order_id,
            "tracking_number": shipping.get("tracking_number") or "",
            "description": normalize_tracking_status(
                tracking.get("description") or detail_payload.get("status", {}).get("status_label", {}).get("text"),
                "Unknown",
            ),
            "shipping_name": address.get("shipping_name") or "",
            "shipping_phone": address.get("shipping_phone") or "",
            "shipping_address": address.get("shipping_address") or "",
            "item_id": item.get("item_id"),
            "model_id": item.get("model_id"),
            "model_name": item.get("model_name") or item.get("model", {}).get("name") or item.get("model", {}).get("model_name") or "",
            "shop_id": item.get("shop_id"),
            "name": item.get("name") or "",
            "image": item.get("image") or "",
            "item_price": item.get("item_price") or 0,
            "order_price": item.get("order_price") or 0,
            "final_total": seed.final_total,
            "order_time": self._extract_order_time(detail_payload),
            "driver_phone": shipping.get("driver_phone") or tracking.get("driver_phone") or delivery.get("driver_phone"),
            "driver_name": shipping.get("driver_name") or tracking.get("driver_name") or delivery.get("driver_name"),
            "raw_detail": detail_payload,
        }

        logistics = self.fetch_logistics(seed.order_id)
        if logistics:
            result["logistics"] = logistics
            if not result["driver_phone"] and logistics.get("history"):
                result["driver_phone"] = logistics["history"][0].get("driver_phone")
            if not result["driver_name"] and logistics.get("history"):
                result["driver_name"] = logistics["history"][0].get("driver_name")

        return result

    def run(self, limit: int = 5, offset: int = 0) -> list[dict[str, Any]]:
        order_seeds = self.fetch_order_list(limit=limit, offset=offset)
        results = []
        for seed in order_seeds:
            results.append(self.build_order_result(seed))
        return results


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Check Shopee orders from SPC_ST using the same call flow as the Node tracking-check route."
    )
    parser.add_argument("cookie", nargs="?", help="Raw SPC_ST token or full cookie header containing SPC_ST=...")
    parser.add_argument("--limit", type=int, default=5, help="List API limit, default 5")
    parser.add_argument("--offset", type=int, default=0, help="List API offset, default 0")
    parser.add_argument("--json", action="store_true", help="Print full JSON")
    parser.add_argument("--save", help="Optional output file path for full JSON")
    return parser


def prompt_cookie() -> str:
    print("Nhap SPC_ST cookie:", file=sys.stderr)
    return sys.stdin.readline().strip()


def print_human_summary(results: list[dict[str, Any]]) -> None:
    print(f"Found {len(results)} orders")
    print("=" * 80)
    for index, order in enumerate(results, start=1):
        print(f"[{index}] order_id      : {order.get('order_id', '')}")
        print(f"    tracking_number : {order.get('tracking_number', '')}")
        print(f"    status          : {order.get('description', '')}")
        print(f"    recipient       : {order.get('shipping_name', '')} | {order.get('shipping_phone', '')}")
        print(f"    address         : {order.get('shipping_address', '')}")
        print(f"    product         : {order.get('name', '')}")
        if order.get("model_name"):
            print(f"    model           : {order.get('model_name')}")
        if order.get("driver_name") or order.get("driver_phone"):
            print(f"    driver          : {order.get('driver_name', '')} | {order.get('driver_phone', '')}")
        logistics = order.get("logistics") or {}
        if logistics.get("carrier_name"):
            print(f"    carrier         : {logistics.get('carrier_name')}")
        if logistics.get("summary"):
            print("    logistics       :")
            for line in str(logistics["summary"]).splitlines():
                print(f"      {line}")
        print("-" * 80)


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    raw_cookie = args.cookie or prompt_cookie()
    if not raw_cookie:
        print("Missing SPC_ST cookie", file=sys.stderr)
        return 1

    try:
        checker = ShopeeTrackingChecker(raw_cookie)
        results = checker.run(limit=args.limit, offset=args.offset)
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    full_output = {
        "count": len(results),
        "orders": results,
    }

    if args.save:
        with open(args.save, "w", encoding="utf-8") as output_file:
            json.dump(full_output, output_file, ensure_ascii=False, indent=2)

    if args.json:
        print(json.dumps(full_output, ensure_ascii=False, indent=2))
    else:
        print_human_summary(results)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())