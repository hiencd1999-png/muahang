"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import {
  ORDER_UNIT_PRICE,
  calculateOrderTotal,
  isValidShopeeLink,
  parseShopeeProductLink,
  suggestAddressOptions,
} from "@/lib/order";
import { useToast } from "@/components/shared/toast";

export function CreateOrderForm({ balance }: { balance: number }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [productLink, setProductLink] = useState("");
  const [resolvedLink, setResolvedLink] = useState("");
  const [productName, setProductName] = useState("");
  const [shopId, setShopId] = useState("");
  const [variantOptions, setVariantOptions] = useState<string[]>([]);
  const [selectedVariant, setSelectedVariant] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [quantity, setQuantity] = useState(2);
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [address, setAddress] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);

  const total = useMemo(() => calculateOrderTotal(quantity), [quantity]);

  const handleAnalyzeLink = async () => {
    setAnalysisError("");
    setAnalysisMessage("");

    if (!productLink.trim()) {
      setAnalysisError("Nhập link sản phẩm Shopee để phân tích.");
      return;
    }

    if (!isValidShopeeLink(productLink)) {
      setAnalysisError('Link sản phẩm phải chứa "shopee".');
      return;
    }

    const parsed = parseShopeeProductLink(productLink);

    try {
      const response = await fetch("/api/shopee/product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productLink }),
      });

      const data = await response.json();
      if (!response.ok) {
        setAnalysisError(data.error ?? "Không lấy được dữ liệu sản phẩm Shopee.");
        return;
      }

      const variants = []; // No variants from API, user inputs manually
      const selected = ""; // User will input manually

      setProductName(data.productName || parsed.productName);
      setShopId(data.shopId || parsed.shopId || "");
      setResolvedLink(data.resolvedLink || productLink);
      setVariantOptions(variants);
      setSelectedVariant(selected);
      setAnalysisMessage(`Link đã được phân tích thành công. Vui lòng nhập phân loại sản phẩm bên dưới.`);
      setAnalysisError("");
    } catch (error) {
      if (parsed.shopId && parsed.itemId) {
        setProductName(parsed.productName);
        setShopId(parsed.shopId);
        setResolvedLink(productLink); // fallback to original
        setVariantOptions([]);
        setSelectedVariant("");
        setAnalysisMessage("Link đã được phân tích cơ bản. Vui lòng nhập phân loại sản phẩm.");
      } else {
        setAnalysisError("Lỗi phân tích link Shopee. Vui lòng thử lại.");
      }
    }
  };

  const handleAnalyzeAddress = () => {
    const suggestions = suggestAddressOptions(address);
    if (suggestions.length === 0) {
      addToast("error", "Vui lòng nhập địa chỉ hợp lệ để phân tích.");
      return;
    }

    setAddressSuggestions(suggestions);
    setShowAddressSuggestions(true);
  };

  const handleUseSuggestion = (value: string) => {
    setAddress(value);
    setShowAddressSuggestions(false);
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    if (!productName || !selectedVariant || !shopId) {
      addToast("error", "Bạn cần phân tích link Shopee và chọn phân loại sản phẩm trước khi đặt đơn.");
      setLoading(false);
      return;
    }

    const payload = {
      productLink: resolvedLink,
      productName,
      shopId,
      quantity,
      phone,
      address,
      variant: selectedVariant,
      note: note.trim() || undefined,
    };

    const response = await fetch("/api/order/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      addToast("error", data.error ?? "Tạo đơn thất bại.");
      setLoading(false);
      return;
    }

    addToast("success", "Tạo đơn thành công!");
    setProductLink("");
    setResolvedLink("");
    setProductName("");
    setShopId("");
    setVariantOptions([]);
    setSelectedVariant("");
    setAnalysisError("");
    setQuantity(2);
    setPhone("");
    setNote("");
    setAddress("");
    setAddressSuggestions([]);
    setShowAddressSuggestions(false);
    router.push("/dashboard/orders");
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.9fr]">
      <form onSubmit={handleSubmit} className="panel rounded-[1.75rem] p-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">Tạo đơn Shopee</h2>
          <p className="text-sm text-slate-600">
            Nhập link Shopee, chọn phân loại sản phẩm, số lượng và địa chỉ giao hàng.
          </p>
        </div>

        <div className="mt-6 grid gap-5">
          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Link sản phẩm</span>
            <input
              value={productLink}
              onChange={(event) => setProductLink(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-500"
              placeholder="https://shopee.vn/..."
            />
            <button
              type="button"
              onClick={handleAnalyzeLink}
              className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Phân tích link
            </button>
            {analysisError ? <p className="text-sm text-rose-600">{analysisError}</p> : null}
          </label>

          {productName ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">Sản phẩm</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{productName}</p>
              {shopId ? (
                <p className="mt-1 text-sm text-slate-600">Shop ID: {shopId}</p>
              ) : null}
              {analysisMessage ? <p className="mt-2 text-sm text-emerald-700">{analysisMessage}</p> : null}
              <p className="mt-3 text-sm text-slate-600">Nhập phân loại sản phẩm:</p>
              {variantOptions.length > 0 ? (
                <select
                  value={selectedVariant}
                  onChange={(event) => setSelectedVariant(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-500"
                >
                  {variantOptions.map((variant) => (
                    <option key={variant} value={variant}>
                      {variant}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={selectedVariant}
                  onChange={(event) => setSelectedVariant(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-500"
                  placeholder="Ví dụ: Đỏ, Size M, Mặc định"
                  required
                />
              )}
            </div>
          ) : null}

          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Số lượng</span>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-500"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>SĐT</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-500"
              placeholder="098xxxx"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Ghi chú SĐT (tùy chọn)</span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-500"
              placeholder="Ví dụ: ghi chú số điện thoại cho nhà bán"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Địa chỉ</span>
            <textarea
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              required
              rows={4}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-500"
              placeholder="Hà Nội ..."
            />
            <button
              type="button"
              onClick={handleAnalyzeAddress}
              className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Phân tích địa chỉ
            </button>
          </label>

          {showAddressSuggestions && addressSuggestions.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900 mb-3">Đề xuất địa chỉ</p>
              <div className="space-y-2">
                {addressSuggestions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleUseSuggestion(option)}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-100"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-6 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Đang đặt đơn..." : "Đặt đơn"}
        </button>
      </form>

      <aside className="panel rounded-[1.75rem] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Bảng tính nhanh</p>
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl bg-white/80 p-4">
            <p className="text-sm text-slate-500">Đơn giá / sản phẩm</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCurrency(ORDER_UNIT_PRICE)}</p>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4">
            <p className="text-sm text-amber-700">Tổng tiền</p>
            <p className="mt-1 text-3xl font-semibold text-amber-900">{formatCurrency(total)}</p>
          </div>
          <div className="rounded-2xl border border-dashed border-slate-300 p-4">
            <p className="text-sm text-slate-500">Số dư hiện tại</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCurrency(balance)}</p>
            <p className="mt-3 text-sm text-slate-600">
              {balance >= total ? "Số dư đủ để tạo đơn." : "Số dư chưa đủ, vui lòng nạp thêm tiền trước khi đặt đơn."}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
