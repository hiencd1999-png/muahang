"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import {
  buildCanonicalShopeeLink,
  isValidShopeeLink,
  parseShopeeProductLink,
} from "@/lib/order";
import { calculateVoucherOrderTotal, type VoucherOption } from "@/lib/voucher";
import { useToast } from "@/components/shared/toast";

export function CreateOrderForm({
  balance,
  voucherConfigs,
}: {
  balance: number;
  voucherConfigs: VoucherOption[];
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const activeVoucherConfigs = voucherConfigs.filter((voucher) => !voucher.isMaintenance);
  const initialVoucherCode = activeVoucherConfigs[0]?.code ?? "";
  const [productLink, setProductLink] = useState("");
  const [resolvedLink, setResolvedLink] = useState("");
  const [productName, setProductName] = useState("");
  const [shopId, setShopId] = useState("");
  const [variantOptions, setVariantOptions] = useState<string[]>([]);
  const [selectedVariant, setSelectedVariant] = useState("");
  const [selectedVoucherCode, setSelectedVoucherCode] = useState(initialVoucherCode);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [quantity, setQuantity] = useState(2);
  const [note, setNote] = useState("");
  const [spcCookieForAddress, setSpcCookieForAddress] = useState("");
  const [address, setAddress] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [isAnalyzingAddress, setIsAnalyzingAddress] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedVoucher = useMemo(
    () => activeVoucherConfigs.find((voucher) => voucher.code === selectedVoucherCode) ?? null,
    [selectedVoucherCode, activeVoucherConfigs]
  );

  const total = useMemo(
    () => calculateVoucherOrderTotal(selectedVoucher?.unitPrice ?? 0, quantity),
    [quantity, selectedVoucher]
  );

  const activeVoucherCount = activeVoucherConfigs.length;

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

      setProductName(data.productName || parsed.productName);
      setShopId(data.shopId || parsed.shopId || "");
      setResolvedLink(data.resolvedLink || productLink);
      setVariantOptions([]);
      setSelectedVariant("");
      setAnalysisMessage("Link đã được phân tích thành công. Vui lòng nhập phân loại sản phẩm bên dưới.");
      setAnalysisError("");
    } catch {
      if (parsed.shopId && parsed.itemId) {
        setProductName(parsed.productName);
        setShopId(parsed.shopId);
        setResolvedLink(buildCanonicalShopeeLink(parsed.shopId, parsed.itemId));
        setVariantOptions([]);
        setSelectedVariant("");
        setAnalysisMessage("Link đã được phân tích cơ bản. Vui lòng nhập phân loại sản phẩm.");
      } else {
        setAnalysisError("Lỗi phân tích link Shopee. Vui lòng thử lại.");
      }
    }
  };

  const handleAnalyzeAddress = async () => {
    const normalizedAddress = address.trim();
    if (!normalizedAddress || normalizedAddress.length < 8) {
      addToast("error", "Vui lòng nhập địa chỉ chi tiết trước khi phân tích.");
      return;
    }

    setIsAnalyzingAddress(true);
    try {
      const response = await fetch("/api/shopee/address-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: normalizedAddress,
          phone: note.trim(),
          note: note.trim(),
          spcCookie: spcCookieForAddress.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        addToast("error", data.error || "Không phân tích được địa chỉ từ Shopee API.");
        return;
      }

      if (!Array.isArray(data.suggestions) || data.suggestions.length === 0) {
        addToast("error", "Shopee API không trả về gợi ý địa chỉ phù hợp.");
        return;
      }

      setAddressSuggestions(data.suggestions);
      setShowAddressSuggestions(true);
      addToast("success", "Đã nhận gợi ý địa chỉ từ Shopee API.");
    } catch {
      addToast("error", "Lỗi khi gọi Shopee API để phân tích địa chỉ.");
    } finally {
      setIsAnalyzingAddress(false);
    }
  };

  const handleUseSuggestion = (value: string) => {
    setAddress(value);
    setShowAddressSuggestions(false);
    addToast("success", "Đã áp dụng địa chỉ đã phân tích.");
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    if (!productName || !selectedVariant || !shopId) {
      addToast("error", "Bạn cần phân tích link Shopee và chọn phân loại sản phẩm trước khi đặt đơn.");
      setLoading(false);
      return;
    }

    if (!selectedVoucher) {
      addToast("error", "Vui lòng chọn loại voucher.");
      setLoading(false);
      return;
    }

    if (selectedVoucher.isMaintenance) {
      addToast("error", `Voucher ${selectedVoucher.label} đang bảo trì.`);
      setLoading(false);
      return;
    }

    const normalizedAddress = note.trim()
      ? `${address.trim()}\nGhi chú SĐT: ${note.trim()}`
      : address.trim();

    const payload = {
      productLink,
      resolvedLink: resolvedLink || productLink,
      productName,
      shopId,
      voucherCode: selectedVoucher.code,
      quantity,
      phone: note.trim() || "Không cung cấp",
      address: normalizedAddress,
      variant: selectedVariant,
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
    setSelectedVoucherCode(initialVoucherCode);
    setAnalysisError("");
    setQuantity(2);
    setNote("");
    setSpcCookieForAddress("");
    setAddress("");
    setAddressSuggestions([]);
    setShowAddressSuggestions(false);
    router.push("/dashboard/orders");
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={handleSubmit} className="panel rounded-[1.75rem] p-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">Tạo đơn Shopee</h2>
          <p className="text-sm text-slate-600">
            Nhập link Shopee, chọn loại voucher, phân loại sản phẩm, số lượng và địa chỉ giao hàng.
          </p>
        </div>

        <div className="mt-6 grid gap-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Loại mã voucher</p>
                <p className="mt-1 text-xs text-slate-500">SPADMIN có thể khóa từng loại voucher bằng chế độ bảo trì.</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                Đang mở: {activeVoucherCount}/{voucherConfigs.length}
              </span>
            </div>
            <select
              value={selectedVoucherCode}
              onChange={(event) => setSelectedVoucherCode(event.target.value as typeof initialVoucherCode)}
              className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-500"
              required
            >
              <option value="">Chọn loại voucher</option>
              {activeVoucherConfigs.map((voucher) => (
                <option key={voucher.code} value={voucher.code}>
                  {voucher.label} - {formatCurrency(voucher.unitPrice)} / sản phẩm
                </option>
              ))}
            </select>

            {selectedVoucher ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Voucher đang chọn</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{selectedVoucher.label}</p>
                  <p className="mt-1 text-sm text-slate-600">Đơn giá: {formatCurrency(selectedVoucher.unitPrice)} / sản phẩm</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Trạng thái</p>
                  <p className={`mt-2 text-lg font-semibold ${selectedVoucher.isMaintenance ? "text-rose-600" : "text-emerald-600"}`}>
                    {selectedVoucher.isMaintenance ? "Đang bảo trì" : "Sẵn sàng tạo đơn"}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

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
              <div className="mt-3 grid gap-3">
                {shopId ? <p className="text-sm text-slate-600">Shop ID: {shopId}</p> : null}
                {resolvedLink ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-medium text-slate-500">Link sau phân tích</p>
                    <a
                      href={resolvedLink}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-1 block break-words text-sm text-amber-700 hover:underline"
                    >
                      {resolvedLink}
                    </a>
                  </div>
                ) : null}
                {analysisMessage ? <p className="text-sm text-emerald-700">{analysisMessage}</p> : null}
              </div>
              <p className="mt-4 text-sm text-slate-600">Nhập phân loại sản phẩm:</p>
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
            <span>Ghi chú SĐT</span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-amber-500"
              placeholder="Ví dụ: 098xxxxxxx - gọi giờ hành chính"
            />
            <p className="text-xs text-slate-500">Ghi chú SĐT sẽ được thêm trực tiếp vào phần địa chỉ giao hàng.</p>
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Cookie SPC_ST (để gọi Shopee API phân tích địa chỉ)</span>
            <textarea
              value={spcCookieForAddress}
              onChange={(event) => setSpcCookieForAddress(event.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-xs outline-none transition focus:border-amber-500"
              placeholder="SPC_ST=..."
            />
            <p className="text-xs text-slate-500">
              Nếu để trống, hệ thống thử dùng cookie cấu hình server. Khuyến nghị dán SPC_ST hợp lệ để trả kết quả chính xác.
            </p>
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
              disabled={isAnalyzingAddress}
              className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAnalyzingAddress ? "Đang phân tích..." : "Phân tích địa chỉ"}
            </button>
          </label>

          {showAddressSuggestions && addressSuggestions.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 text-sm font-semibold text-slate-900">Đề xuất địa chỉ</p>
              <p className="mb-3 text-xs text-slate-500">
                Dữ liệu được phân tích trực tiếp từ Shopee API (autofill) để tăng khả năng add địa chỉ thành công.
              </p>
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
          disabled={loading || !selectedVoucher || selectedVoucher.isMaintenance}
          className="mt-6 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Đang đặt đơn..." : "Đặt đơn"}
        </button>
      </form>

      <aside className="panel rounded-[1.75rem] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Bảng tính nhanh</p>
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl bg-white/80 p-4">
            <p className="text-sm text-slate-500">Voucher</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{selectedVoucher?.label ?? "Chưa chọn"}</p>
          </div>
          <div className="rounded-2xl bg-white/80 p-4">
            <p className="text-sm text-slate-500">Đơn giá / sản phẩm</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCurrency(selectedVoucher?.unitPrice ?? 0)}</p>
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
