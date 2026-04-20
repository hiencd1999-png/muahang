import { HttpsProxyAgent } from "https-proxy-agent";
import fetch from "node-fetch";

export const TRACKING_STATUS_MAP: Record<string, string> = {
  label_preparing_order: "Đang chuẩn bị đơn hàng",
  preparing_order: "Đang chuẩn bị đơn hàng",
  label_order_prepared: "Đơn hàng đã sẵn sàng",
  order_prepared: "Đơn hàng đã sẵn sàng",
  label_to_ship: "Chờ gửi hàng",
  to_ship: "Chờ gửi hàng",
  order_list_text_to_ship_edt: "Chờ gửi hàng",
  order_status_text_to_ship_order_edt_cod: "Chờ gửi hàng (COD)",
  order_status_text_to_ship_order_edt: "Chờ gửi hàng",
  label_waiting_pickup: "Chờ lấy hàng",
  waiting_pickup: "Chờ lấy hàng",
  label_pickup_scheduled: "Đã lên lịch lấy hàng",
  pickup_scheduled: "Đã lên lịch lấy hàng",
  label_in_transit: "Đang vận chuyển",
  in_transit: "Đang vận chuyển",
  label_on_the_way: "Đang trên đường giao",
  on_the_way: "Đang trên đường giao",
  label_out_for_delivery: "Đang giao hàng",
  out_for_delivery: "Đang giao hàng",
  label_delivered: "Đã giao hàng",
  delivered: "Đã giao hàng",
  label_delivery_confirmed: "Đã xác nhận giao hàng",
  delivery_confirmed: "Đã xác nhận giao hàng",
  label_completed: "Hoàn thành",
  completed: "Hoàn thành",
  label_order_completed: "Đơn hàng hoàn thành",
  order_completed: "Đơn hàng hoàn thành",
  label_cancelled: "Đã hủy",
  cancelled: "Đã hủy",
  label_order_cancelled: "Đã hủy",
  order_cancelled: "Đã hủy",
  label_cancel_order_reason_admin_901: "Hủy bởi hệ thống",
  cancel_order_reason_admin_901: "Hủy bởi hệ thống",
  label_return_requested: "Yêu cầu hoàn trả",
  return_requested: "Yêu cầu hoàn trả",
  label_returned: "Đã hoàn trả",
  returned: "Đã hoàn trả",
  label_refunded: "Đã hoàn tiền",
  refunded: "Đã hoàn tiền",
  label_pending_payment: "Chờ thanh toán",
  pending_payment: "Chờ thanh toán",
  label_payment_failed: "Thanh toán thất bại",
  payment_failed: "Thanh toán thất bại",
  label_processing: "Đang xử lý",
  processing: "Đang xử lý",
  label_ship_by_date_not_calculated: "Đang xử lý",
  ship_by_date_not_calculated: "Đang xử lý",
  label_confirmed: "Đã xác nhận",
  confirmed: "Đã xác nhận",
  label_delivery_failed: "Giao hàng thất bại",
  delivery_failed: "Giao hàng thất bại",
  label_delivery_attempted: "Đã thử giao hàng",
  delivery_attempted: "Đã thử giao hàng",
  label_delivery_delayed: "Giao hàng bị trễ",
  delivery_delayed: "Giao hàng bị trễ",
  label_arrived_at_warehouse: "Đã đến kho",
  arrived_at_warehouse: "Đã đến kho",
  label_left_warehouse: "Đã rời kho",
  left_warehouse: "Đã rời kho",
  label_at_sorting_center: "Đang tại trung tâm phân loại",
  at_sorting_center: "Đang tại trung tâm phân loại",
};

export function normalizeCookie(rawCookie: string): string {
  const value = rawCookie.trim();
  if (!value) throw new Error("Empty cookie");
  return value.includes("SPC_ST=") ? value : `SPC_ST=${value}`;
}

export function normalizeTrackingStatus(value: string | undefined | null, fallback: string = ""): string {
  if (!value) return fallback;
  const normalized = String(value).trim();
  if (!normalized) return fallback;

  if (TRACKING_STATUS_MAP[normalized]) return TRACKING_STATUS_MAP[normalized];
  const lowerValue = normalized.toLowerCase();
  if (TRACKING_STATUS_MAP[lowerValue]) return TRACKING_STATUS_MAP[lowerValue];

  if (lowerValue.startsWith("label_")) {
    const noLabel = lowerValue.replace("label_", "");
    return TRACKING_STATUS_MAP[noLabel] || normalized;
  }
  return normalized;
}

export function formatHistoryTime(unixSeconds: number | string | undefined | null): string {
  if (!unixSeconds) return "";
  try {
    const d = new Date(Number(unixSeconds) * 1000);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month} ${h}:${m}`;
  } catch {
    return "";
  }
}

export function formatFullDate(unixSeconds: number | string | undefined | null): string {
  if (!unixSeconds) return "";
  try {
    const d = new Date(Number(unixSeconds) * 1000);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "";
  }
}

export class ShopeeTrackingChecker {
  private cookie: string;
  private timeout: number;
  private proxyAgent?: any;

  constructor(spcStCookie: string, proxyConf?: any, timeout: number = 15000) {
    this.cookie = normalizeCookie(spcStCookie);
    this.timeout = timeout;
    if (proxyConf) {
      const proxyUrl = `http://${proxyConf.username}:${proxyConf.password}@${proxyConf.host}:${proxyConf.port}`;
      this.proxyAgent = new HttpsProxyAgent(proxyUrl);
    }
  }

  private async requestJson(
    url: string,
    options: { host: string; referer: string; userAgent: string; extraHeaders?: Record<string, string> }
  ): Promise<any> {
    const headers: Record<string, string> = {
      Host: options.host,
      Cookie: this.cookie,
      "User-Agent": options.userAgent,
      Accept: "*/*",
      Referer: options.referer,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      ...(options.extraHeaders || {}),
    };

    const fetchOptions: any = {
      method: "GET",
      headers,
      timeout: this.timeout,
    };
    if (this.proxyAgent) {
      fetchOptions.agent = this.proxyAgent;
    }

    const response = await fetch(url, fetchOptions);
    const body = await response.text();

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("SPC_ST expired or invalid");
      }
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 300)}`);
    }

    let payload: any;
    try {
      payload = JSON.parse(body);
    } catch {
      throw new Error(`Invalid JSON response: ${body.slice(0, 300)}`);
    }

    const errorCode = payload?.error;
    const errorMsg = String(payload?.error_msg || "").trim();
    if (errorCode != null && errorCode !== 0) {
      throw new Error(`Shopee error ${errorCode}: ${errorMsg || "unknown"}`);
    }

    const lowered = errorMsg.toLowerCase();
    if (lowered.includes("authenticate") || lowered.includes("invalid cookie") || lowered.includes("please log in") || lowered.includes("failed")) {
      throw new Error(`Shopee rejected cookie: ${errorMsg}`);
    }

    return payload;
  }

  public async fetchOrderList(limit: number = 5, offset: number = 0): Promise<any[]> {
    const url = `https://shopee.vn/api/v4/order/get_all_order_and_checkout_list?limit=${limit}&offset=${offset}`;
    const payload = await this.requestJson(url, {
      host: "shopee.vn",
      referer: "https://shopee.vn/",
      userAgent: "Android app Shopee appver=28320 app_type=1",
      extraHeaders: { "Content-Type": "application/json" },
    });

    const ordersOld = payload?.data?.order_data?.details_list || [];
    const ordersNew = payload?.new_data?.order_or_checkout_data || [];

    const orderMap = new Map<string, any>();

    for (const order of ordersOld) {
      const info = order?.info_card || {};
      const orderId = info.order_id;
      if (orderId) {
        orderMap.set(String(orderId), {
          order_id: String(orderId),
          final_total: Number(info.final_total) || 0,
          cached_detail: order,
        });
      }
    }

    for (const item of ordersNew) {
      const detail = item?.order_list_detail || item || {};
      const info = detail?.info_card || {};
      const orderId = info.order_id;
      if (orderId) {
        orderMap.set(String(orderId), {
          order_id: String(orderId),
          final_total: Number(info.final_total) || 0,
          cached_detail: detail,
        });
      }
    }

    return Array.from(orderMap.values());
  }

  public async fetchOrderDetail(orderId: string): Promise<any> {
    const url = `https://shopee.vn/api/v4/order/get_order_detail?_oft=0&order_id=${encodeURIComponent(orderId)}`;
    const payload = await this.requestJson(url, {
      host: "shopee.vn",
      referer: "https://shopee.vn/",
      userAgent: "Android app Shopee appver=28320 app_type=1",
      extraHeaders: {
        "Content-Type": "application/json",
        "X-Order-ID": orderId,
      },
    });
    return payload?.data || {};
  }

  public async fetchLogistics(orderId: string): Promise<any> {
    const url = `https://mall.shopee.vn/api/v4/order/buyer/get_logistics_info?_oft=0&order_id=${encodeURIComponent(orderId)}`;
    const payload = await this.requestJson(url, {
      host: "mall.shopee.vn",
      referer: "https://mall.shopee.vn/",
      userAgent: "iOS app iPhone Shopee appver=36649 language=vi app_type=1 platform=native_ios os_ver=26.2.1 Cronet/102.0.5005.61",
      extraHeaders: {
        "X-Shopee-Client-Timezone": "Asia/Ho_Chi_Minh",
      },
    });

    const data = payload?.data;
    if (!data) return null;

    const trackingItems = data.tracking_info_list || [];
    const history = [];
    for (const item of trackingItems) {
      let desc = item.description || "";
      let normalizedDesc = normalizeTrackingStatus(desc, "");
      const pinCode = item.pin_code || item.pinCode || data.pin_code || data.pinCode;
      
      if (desc.toLowerCase().includes("người mua có thể đến nhận hàng tại")) {
         if (pinCode) {
            normalizedDesc = `${desc} | Mã pin: ${pinCode}`;
         } else {
            normalizedDesc = desc;
         }
      }

      history.push({
        ctime: item.ctime,
        ctime_text: formatHistoryTime(item.ctime),
        description: normalizedDesc,
        pin_code: pinCode,
        driver_phone: item.driver_phone || "",
        driver_name: item.driver_name || "",
        license_plate_number: item.license_plate_number || "",
      });
    }

    const carrierName = data.carrier_name || data.channel_name || "Unknown";
    const trackingNumber = data.tracking_number || "";
    const expectedType = normalizeTrackingStatus(data.time_display?.type, "Expected delivery");
    const expectedText = formatFullDate(data.time_display?.time);

    return {
      shipping_status: normalizeTrackingStatus(data.shipping_status, ""),
      carrier_name: carrierName,
      tracking_number: trackingNumber,
      expected_time_type: expectedType,
      expected_time_text: expectedText,
      history,
    };
  }

  public async run(limit: number = 5, offset: number = 0): Promise<any[]> {
    const seeds = await this.fetchOrderList(limit, offset);
    const results = [];
    for (const seed of seeds) {
      const detailPayload = await this.fetchOrderDetail(seed.order_id);
      
      const shipping = detailPayload.shipping || {};
      const tracking = shipping.tracking_info || {};
      const address = detailPayload.address || {};
      
      // Extract item
      let item: any = {};
      const parcelCards = detailPayload.info_card?.parcel_cards || [];
      const orderListCards = detailPayload.info_card?.order_list_cards || [];
      if (parcelCards.length > 0) {
        item = parcelCards[0]?.product_info?.item_groups?.[0]?.items?.[0] || {};
      } else if (orderListCards.length > 0) {
        const pc = orderListCards[0]?.parcel_cards || [];
        if (pc.length > 0) {
          item = pc[0]?.product_info?.item_groups?.[0]?.items?.[0] || {};
        }
      } else {
        item = detailPayload.info_card?.product_info?.item_groups?.[0]?.items?.[0] || {};
      }

      let rootDesc = tracking.description || detailPayload.status?.status_label?.text || "";
      let rootDescStr = normalizeTrackingStatus(rootDesc, "Unknown");
      const pinCode = shipping.pin_code || shipping.pinCode || tracking.pin_code || tracking.pinCode;
      
      if (rootDesc.toLowerCase().includes("người mua có thể đến nhận hàng tại")) {
         if (pinCode) {
            rootDescStr = `${rootDesc} | Mã pin: ${pinCode}`;
         } else {
            rootDescStr = rootDesc;
         }
      }

      const result: any = {
        order_id: seed.order_id,
        tracking_number: shipping.tracking_number || "",
        description: rootDescStr,
        shipping_name: address.shipping_name || "",
        shipping_phone: address.shipping_phone || "",
        shipping_address: address.shipping_address || "",
        name: item.name || "",
        model_name: item.model_name || item.model?.name || item.model?.model_name || "",
        driver_phone: shipping.driver_phone || tracking.driver_phone || "",
        driver_name: shipping.driver_name || tracking.driver_name || "",
      };

      const logistics = await this.fetchLogistics(seed.order_id);
      if (logistics) {
        result.logistics = logistics;
        if (!result.driver_phone && logistics.history?.length) {
          result.driver_phone = logistics.history[0].driver_phone;
        }
        if (!result.driver_name && logistics.history?.length) {
          result.driver_name = logistics.history[0].driver_name;
        }
      }

      results.push(result);
    }
    return results;
  }
}
