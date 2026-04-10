"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import {
  buildCanonicalShopeeLink,
  isValidShopeeLink,
  parseShopeeProductLink,
} from "@/lib/order";
import { calculateVoucherOrderTotal, type VoucherOption } from "@/lib/voucher";
import { useToast } from "@/components/shared/toast";

interface OrderDraftItem {
  id: string;
  productLink: string;
  resolvedLink: string;
  productName: string;
  shopId: string;
  quantity: string;
  variantOptions: string[];
  selectedVariant: string;
  analysisError: string;
  analysisMessage: string;
  isAnalyzing: boolean;
}

function generateId() {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

function createEmptyOrderItem(): OrderDraftItem {
  return {
    id: generateId(),
    productLink: "",
    resolvedLink: "",
    productName: "",
    shopId: "",
    quantity: "1",
    variantOptions: [],
    selectedVariant: "",
    analysisError: "",
    analysisMessage: "",
    isAnalyzing: false,
  };
}

function isEmptyDraftItem(item: OrderDraftItem) {
  return !item.productLink.trim() && !item.productName.trim() && !item.selectedVariant.trim() && !item.shopId.trim();
}

export function CreateOrderForm({
  balance,
  voucherConfigs,
  admins,
}: {
  balance: number;
  voucherConfigs: VoucherOption[];
  admins: { id: number; displayName: string }[];
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const activeVoucherConfigs = voucherConfigs.filter((voucher) => !voucher.isMaintenance);
  const initialVoucherCode = activeVoucherConfigs[0]?.code ?? "";

  const [orderItems, setOrderItems] = useState<OrderDraftItem[]>([createEmptyOrderItem()]);
  const [selectedVoucherCode, setSelectedVoucherCode] = useState(initialVoucherCode);
  const [requestedAdminId, setRequestedAdminId] = useState("");
  const [searchRequestedAdmin, setSearchRequestedAdmin] = useState("");
  const [note, setNote] = useState("");
  const [address, setAddress] = useState("");
  const [ward, setWard] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [isAnalyzingAddress, setIsAnalyzingAddress] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedVoucher = useMemo(
    () => activeVoucherConfigs.find((voucher) => voucher.code === selectedVoucherCode) ?? null,
    [activeVoucherConfigs, selectedVoucherCode]
  );

  const nonEmptyItems = useMemo(
    () => orderItems.filter((item) => !isEmptyDraftItem(item)),
    [orderItems]
  );

  const totalQuantity = useMemo(
    () => nonEmptyItems.reduce((sum, item) => sum + Math.max(1, item.quantity === "" ? 1 : Number(item.quantity)), 0),
    [nonEmptyItems]
  );

  const total = useMemo(
    () => calculateVoucherOrderTotal(selectedVoucher?.unitPrice ?? 0, totalQuantity),
    [selectedVoucher, totalQuantity]
  );

  const activeVoucherCount = activeVoucherConfigs.length;

  const filteredAdmins = useMemo(() => {
    if (!admins) return [];
    return admins.filter((admin) =>
      admin.displayName?.toLowerCase().includes(searchRequestedAdmin.toLowerCase() || "")
    );
  }, [admins, searchRequestedAdmin]);

  const updateOrderItem = (itemId: string, updater: (item: OrderDraftItem) => OrderDraftItem) => {
    setOrderItems((current) => current.map((item) => (item.id === itemId ? updater(item) : item)));
  };

  const addOrderItem = () => {
    setOrderItems((current) => [...current, createEmptyOrderItem()]);
  };

  const removeOrderItem = (itemId: string) => {
    setOrderItems((current) => {
      if (current.length === 1) {
        return [createEmptyOrderItem()];
      }

      return current.filter((item) => item.id !== itemId);
    });
  };

  const handleAnalyzeLink = async (itemId: string) => {
    const currentItem = orderItems.find((item) => item.id === itemId);
    if (!currentItem) {
      return;
    }

    const currentLink = currentItem.productLink.trim();
    updateOrderItem(itemId, (item) => ({
      ...item,
      analysisError: "",
      analysisMessage: "",
    }));

    if (!currentLink) {
      updateOrderItem(itemId, (item) => ({
        ...item,
        analysisError: "Nhập link sản phẩm Shopee để phân tích.",
      }));
      return;
    }

    if (!isValidShopeeLink(currentLink)) {
      updateOrderItem(itemId, (item) => ({
        ...item,
        analysisError: 'Link sản phẩm phải chứa "shopee".',
      }));
      return;
    }

    const parsed = parseShopeeProductLink(currentLink);

    updateOrderItem(itemId, (item) => ({
      ...item,
      isAnalyzing: true,
    }));

    try {
      const response = await fetch("/api/shopee/product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productLink: currentLink }),
      });

      const data = await response.json();
      if (!response.ok) {
        updateOrderItem(itemId, (item) => ({
          ...item,
          isAnalyzing: false,
          analysisError: data.error ?? "Không lấy được dữ liệu sản phẩm Shopee.",
        }));
        return;
      }

      const variants = Array.isArray(data.variants) && data.variants.length > 0
        ? data.variants.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
        : parsed.variants;

      updateOrderItem(itemId, (item) => ({
        ...item,
        productName: data.productName || parsed.productName,
        shopId: data.shopId || parsed.shopId || "",
        resolvedLink: data.resolvedLink || currentLink,
        variantOptions: [],
        selectedVariant: item.selectedVariant || "",
        analysisMessage: "Link đã được phân tích thành công. Vui lòng nhập phân loại cho link này.",
        analysisError: "",
        isAnalyzing: false,
      }));
    } catch {
      if (parsed.shopId && parsed.itemId) {
        const fallbackShopId = parsed.shopId;
        const fallbackItemId = parsed.itemId;

        updateOrderItem(itemId, (item) => ({
          ...item,
          productName: parsed.productName,
          shopId: fallbackShopId,
          resolvedLink: buildCanonicalShopeeLink(fallbackShopId, fallbackItemId),
          variantOptions: [],
          selectedVariant: item.selectedVariant || "",
          analysisMessage: "Link đã được phân tích cơ bản. Vui lòng nhập phân loại cho link này.",
          analysisError: "",
          isAnalyzing: false,
        }));
      } else {
        updateOrderItem(itemId, (item) => ({
          ...item,
          isAnalyzing: false,
          analysisError: "Lỗi phân tích link Shopee. Vui lòng thử lại.",
        }));
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
      
      const parsedWard = data.parsed?.adminDivision3;
      if (parsedWard) {
        setWard(parsedWard);
      } else {
        setWard("Không xác định (Chưa nhận diện được phường)");
      }
      
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const itemsToSubmit = orderItems.filter((item) => !isEmptyDraftItem(item));

    if (!ward) {
      addToast("error", "Bắt buộc phải bấm phân tích địa chỉ trước khi tạo đơn.");
      return;
    }

    if (itemsToSubmit.length === 0) {
      addToast("error", "Thêm ít nhất một link sản phẩm trước khi đặt đơn.");
      return;
    }

    if (!selectedVoucher) {
      addToast("error", "Vui lòng chọn loại voucher.");
      return;
    }

    for (const [index, item] of itemsToSubmit.entries()) {
      if (!item.productLink.trim()) {
        addToast("error", `Dòng ${index + 1} chưa có link sản phẩm.`);
        return;
      }

      if (!item.productName.trim() || !item.shopId.trim()) {
        addToast("error", `Dòng ${index + 1} cần phân tích link Shopee trước khi đặt đơn.`);
        return;
      }

      if (item.selectedVariant.trim() === "") {
        addToast("error", `Dòng ${index + 1} chưa nhập phân loại sản phẩm.`);
        return;
      }

      const parsedQty = item.quantity === "" ? 1 : Number(item.quantity);
      if (!Number.isFinite(parsedQty) || parsedQty < 1) {
        addToast("error", `Dòng ${index + 1} cần số lượng hợp lệ (>= 1).`);
        return;
      }
    }

    const normalizedAddress = note.trim()
      ? `${address.trim()}\nGhi chú SĐT: ${note.trim()}`
      : address.trim();

    setLoading(true);

    const payload = {
      items: itemsToSubmit.map((item) => ({
        productLink: item.productLink.trim(),
        resolvedLink: item.resolvedLink.trim() || item.productLink.trim(),
        productName: item.productName.trim(),
        shopId: item.shopId.trim(),
        variant: item.selectedVariant.trim(),
        quantity: item.quantity === "" ? 1 : Math.max(1, Number(item.quantity)),
      })),
      voucherCode: selectedVoucher.code,
      phone: note.trim() || "Không cung cấp",
      address: normalizedAddress,
      ward: ward,
      note: note.trim(),
      requestedAdminId: requestedAdminId ? parseInt(requestedAdminId, 10) : undefined,
    };

    try {
      const response = await fetch("/api/order/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        addToast("error", data.error ?? "Tạo đơn thất bại.");
        return;
      }

      addToast("success", "Đã tạo đơn hàng thành công.");
      setOrderItems([createEmptyOrderItem()]);
      setSelectedVoucherCode(initialVoucherCode);
      setRequestedAdminId("");
      setNote("");
      setAddress("");
      setWard("");
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      router.push("/dashboard/orders");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <form onSubmit={handleSubmit} className="panel rounded-[1.75rem] p-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Tạo đơn Shopee</h2>
        </div>

        <div className="mt-6 grid gap-5">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/80 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Thiết lập đơn chung</p>
              </div>
              <span className="rounded-full bg-white dark:bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 border dark:border-slate-700/80">
                Đang mở: {activeVoucherCount}/{voucherConfigs.length}
              </span>
            </div>
            <div className="mt-4 grid gap-4 grid-cols-1">
              <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <span>Loại voucher</span>
                <select
                  value={selectedVoucherCode}
                  onChange={(event) => setSelectedVoucherCode(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-950 px-4 py-3 text-slate-900 dark:text-white outline-none transition focus:border-amber-500"
                  required
                >
                  <option value="" className="dark:bg-slate-900">Chọn loại voucher</option>
                  {activeVoucherConfigs.map((voucher) => (
                    <option key={voucher.code} value={voucher.code} className="dark:bg-slate-900">
                      {voucher.label} - {formatCurrency(voucher.unitPrice)} / sản phẩm
                    </option>
                  ))}
                </select>
              </label>

              {admins && admins.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Chọn Admin phụ trách (Tuỳ chọn)</p>
                    <input 
                       type="text" 
                       placeholder="🔎 Tìm admin..."
                       value={searchRequestedAdmin}
                       onChange={e => setSearchRequestedAdmin(e.target.value)}
                       className="w-full sm:w-48 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm outline-none transition focus:border-amber-500"
                    />
                  </div>
                  <select
                    value={requestedAdminId}
                    onChange={(event) => setRequestedAdminId(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-950 px-4 py-3 text-slate-900 dark:text-white outline-none transition focus:border-amber-500"
                  >
                    <option value="" className="dark:bg-slate-900">Bất kỳ ai (Hệ thống tự chọn)</option>
                    {filteredAdmins.map((admin) => (
                      <option key={admin.id} value={admin.id.toString()} className="dark:bg-slate-900">
                        {admin.displayName}
                      </option>
                    ))}
                    {filteredAdmins.length === 0 && searchRequestedAdmin && (
                      <option disabled value="" className="dark:bg-slate-900">Không tìm thấy admin nào</option>
                    )}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {orderItems.map((item, index) => (
              <section key={item.id} className="rounded-3xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-950/40 p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Sản phẩm {index + 1}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeOrderItem(item.id)}
                    className="rounded-2xl border border-rose-200 dark:border-rose-900/30 bg-rose-50 dark:bg-rose-900/20 px-4 py-2 text-sm font-semibold text-rose-700 dark:text-rose-400 transition hover:bg-rose-100 dark:hover:bg-rose-900/30"
                  >
                    Xóa dòng
                  </button>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-300 lg:col-span-2">
                    <span>Link sản phẩm</span>
                    <textarea
                      value={item.productLink}
                      onChange={(event) => updateOrderItem(item.id, (current) => ({
                        ...current,
                        productLink: event.target.value,
                        analysisError: "",
                        analysisMessage: "",
                      }))}
                      rows={2}
                      className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-950 px-4 py-3 text-slate-900 dark:text-white outline-none transition focus:border-amber-500"
                      placeholder="https://shopee.vn/..."
                    />
                    <button
                      type="button"
                      onClick={() => handleAnalyzeLink(item.id)}
                      disabled={item.isAnalyzing}
                      className="rounded-2xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {item.isAnalyzing ? "Đang phân tích..." : "Phân tích link"}
                    </button>
                    {item.analysisError ? <p className="text-sm text-rose-600 dark:text-rose-400">{item.analysisError}</p> : null}
                  </label>

                  <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-300 lg:col-span-2">
                    <span>Link sản phẩm</span>
                    <textarea
                      value={item.productLink}
                      onChange={(event) => updateOrderItem(item.id, (current) => ({
                        ...current,
                        productLink: event.target.value,
                        analysisError: "",
                        analysisMessage: "",
                      }))}
                      rows={2}
                      className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-950 px-4 py-3 text-slate-900 dark:text-white outline-none transition focus:border-amber-500"
                      placeholder="https://shopee.vn/..."
                    />
                    <button
                      type="button"
                      onClick={() => handleAnalyzeLink(item.id)}
                      disabled={item.isAnalyzing}
                      className="rounded-2xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {item.isAnalyzing ? "Đang phân tích..." : "Phân tích link"}
                    </button>
                    {item.analysisError ? <p className="text-sm text-rose-600 dark:text-rose-400">{item.analysisError}</p> : null}
                  </label>

                  {item.productName ? (
                    <div className="lg:col-span-2 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 p-4">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-400">Sản phẩm</p>
                      <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">{item.productName}</p>
                      <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-950 p-3">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Shop ID</p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{item.shopId || "-"}</p>
                      </div>

                      {item.resolvedLink ? (
                        <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-300">Link sau phân tích</p>
                          <a
                            href={item.resolvedLink}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="mt-1 block break-words text-sm text-amber-700 dark:text-amber-400 hover:underline"
                          >
                            {item.resolvedLink}
                          </a>
                        </div>
                      ) : null}

                      {item.analysisMessage ? <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">{item.analysisMessage}</p> : null}

                      <div className="mt-4">
                        <p className="text-sm text-slate-600 dark:text-slate-300">Phân loại sản phẩm cho link này</p>
                        <input
                          value={item.selectedVariant}
                          onChange={(event) => updateOrderItem(item.id, (current) => ({
                            ...current,
                            selectedVariant: event.target.value,
                          }))}
                          className="mt-2 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white outline-none transition focus:border-amber-500"
                          placeholder="Ví dụ: Đỏ, Size M, Mặc định"
                          required
                        />
                      </div>

                      <div className="mt-4">
                        <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                          <span>Số lượng sản phẩm này</span>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(event) => updateOrderItem(item.id, (current) => ({
                              ...current,
                              quantity: event.target.value,
                            }))}
                            placeholder="Mặc định là 1"
                            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white outline-none transition focus:border-amber-500"
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            ))}
          </div>

          <button
            type="button"
            onClick={addOrderItem}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700/80 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300 transition hover:border-amber-300 dark:hover:border-amber-800 hover:text-amber-700 dark:hover:text-amber-500"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Thêm link sản phẩm
          </button>

          <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <span>Ghi chú SĐT</span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-950 px-4 py-3 text-slate-900 dark:text-white outline-none transition focus:border-amber-500"
              placeholder="Ví dụ: 098xxxxxxx - gọi giờ hành chính"
            />
            <p className="text-xs text-slate-500 dark:text-slate-300">Ghi chú SĐT sẽ được thêm trực tiếp vào phần địa chỉ giao hàng.</p>
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <span>Địa chỉ</span>
            <textarea
              value={address}
              onChange={(event) => {
                setAddress(event.target.value);
                setWard(""); // Reset ward when manually edited
              }}
              required
              rows={4}
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-950 px-4 py-3 text-slate-900 dark:text-white outline-none transition focus:border-amber-500"
              placeholder="Hà Nội ..."
            />
            <button
              type="button"
              onClick={handleAnalyzeAddress}
              disabled={isAnalyzingAddress}
              className="rounded-2xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAnalyzingAddress ? "Đang phân tích..." : "Phân tích địa chỉ"}
            </button>
          </label>

          {showAddressSuggestions && addressSuggestions.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 p-4">
              <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Đề xuất địa chỉ</p>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-300">
                Dữ liệu được phân tích trực tiếp từ Shopee API (autofill) để tăng khả năng add địa chỉ thành công.
              </p>
              <div className="space-y-2">
                {addressSuggestions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleUseSuggestion(option)}
                    className="w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
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
          disabled={loading || !selectedVoucher || activeVoucherCount === 0}
          className="mt-6 w-full lg:w-auto rounded-2xl bg-amber-600 px-8 py-4 text-sm font-semibold text-white transition hover:bg-amber-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 shadow-lg shadow-amber-200 dark:shadow-none"
        >
          {loading ? "Đang đặt đơn..." : "Đặt đơn ngay"}
        </button>
      </form>

      <aside className="panel rounded-[1.75rem] p-6 xl:sticky xl:top-6 xl:self-start">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-300">Bảng tính nhanh</p>
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl bg-white/80 dark:bg-slate-800/80 p-4 border dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-300">Số link đang nhập</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{nonEmptyItems.length}</p>
          </div>
          <div className="rounded-2xl bg-white/80 dark:bg-slate-800/80 p-4 border dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-300">Tổng số lượng sản phẩm</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{totalQuantity}</p>
          </div>
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/10 p-5 border border-amber-200 dark:border-amber-900/40">
            <p className="text-[10px] text-amber-700 dark:text-amber-500 font-bold uppercase tracking-wider">Tổng tiền đơn</p>
            <p className="mt-2 text-3xl font-black text-amber-900 dark:text-amber-200">{formatCurrency(total)}</p>
          </div>
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-300">Số dư hiện tại</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(balance)}</p>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              {balance >= total ? "Số dư đủ để tạo đơn." : "Số dư chưa đủ, vui lòng nạp thêm tiền trước khi đặt đơn."}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
