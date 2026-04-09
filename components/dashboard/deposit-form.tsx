"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/shared/toast";
import { Copy, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

export function DepositForm() {
  const router = useRouter();
  const { addToast } = useToast();
  
  const [method, setMethod] = useState<"VND" | "USDT">("USDT");
  
  const [loadingVnd, setLoadingVnd] = useState(false);
  const vndInputRef = useRef<HTMLInputElement>(null);

  const [loadingUsdt, setLoadingUsdt] = useState(false);
  const [usdtNetwork, setUsdtNetwork] = useState<"BSC" | "TRX">("BSC");
  const usdtInputRef = useRef<HTMLInputElement>(null);
  const [usdtOrder, setUsdtOrder] = useState<any>(null);

  const presetsVnd = [
    { label: "100k", value: 100000 },
    { label: "250k", value: 250000 },
    { label: "500k", value: 500000 },
    { label: "1M", value: 1000000 },
  ];

  const presetsUsdt = [
    { label: "10 USDT", value: 10 },
    { label: "20 USDT", value: 20 },
    { label: "50 USDT", value: 50 },
    { label: "100 USDT", value: 100 },
  ];

  const handlePresetVnd = (amount: number) => {
    if (bankInputRef.current) {
      bankInputRef.current.value = amount.toString();
      bankInputRef.current.focus();
    }
  };

  const handlePresetUsdt = (amount: number) => {
    if (usdtInputRef.current) {
      usdtInputRef.current.value = amount.toString();
      usdtInputRef.current.focus();
    }
  };

  // Bank state
  const [loadingBank, setLoadingBank] = useState(false);
  const bankInputRef = useRef<HTMLInputElement>(null);
  const [bankConfigs, setBankConfigs] = useState<any[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<number | null>(null);
  const [bankOrder, setBankOrder] = useState<any>(null);

  // Khôi phục lệnh PENDING nếu người dùng F5 hoặc quay lại
  useEffect(() => {
    async function fetchPendingOrder() {
       try {
          let hasPendingUsdt = false;
          let hasPendingBank = false;

          // Fetch pending USDT order
          const resUsdt = await fetch("/api/top-up/usdt/history");
          if (resUsdt.ok) {
              const deposits = await resUsdt.json();
              const pending = deposits.find((d: any) => d.status === "PENDING");
              if (pending) {
                 setUsdtOrder({ ...pending, orderId: pending.id });
                 hasPendingUsdt = true;
              }
          }

          // Fetch pending BANK order
          const resBank = await fetch("/api/top-up/bank/history");
          if (resBank.ok) {
              const deposits = await resBank.json();
              const pendingOrTransferring = deposits.find((d: any) => d.status === "PENDING" || d.status === "TRANSFERRED" || d.status === "COMPLAINED");
              if (pendingOrTransferring) {
                 setBankOrder({ ...pendingOrTransferring, orderId: pendingOrTransferring.id });
                 hasPendingBank = true;
              }
          }

          if (hasPendingBank) {
             setMethod("VND");
          } else if (hasPendingUsdt) {
             setMethod("USDT");
          }
       } catch (e) {}
    }
    fetchPendingOrder();
    
    // Fetch active bank configs
    fetch("/api/top-up/bank/configs")
        .then(res => res.json())
        .then(data => {
            if (data.configs) {
               setBankConfigs(data.configs);
               if (data.configs.length > 0) setSelectedAdminId(data.configs[0].adminId);
            }
        });
  }, []);

  useEffect(() => {
    if (!bankOrder || bankOrder.status === "COMPLETED" || bankOrder.status === "EXPIRED" || bankOrder.status === "REJECTED") return;

    const interval = setInterval(async () => {
      try {
        const orderId = bankOrder.orderId || bankOrder.id;
        const res = await fetch(`/api/top-up/bank/${orderId}`);
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.status === "COMPLETED") {
           setBankOrder((prev: any) => ({ ...prev, status: "COMPLETED" }));
           addToast("success", "Admin đã duyệt. Đã cộng số dư!");
           router.refresh();
           clearInterval(interval);
        } else if (data.status === "EXPIRED") {
           setBankOrder((prev: any) => ({ ...prev, status: "EXPIRED" }));
           addToast("error", "Lệnh nạp Bank đã hết hạn.");
           clearInterval(interval);
        } else if (data.status === "REJECTED") {
           setBankOrder((prev: any) => ({ ...prev, status: "REJECTED" }));
           addToast("error", "Admin đã từ chối lệnh nạp tiền của bạn.");
           clearInterval(interval);
        } else {
           setBankOrder((prev: any) => {
               if (prev && prev.status === data.status) return prev; // Do not mutate if unchanged
               return { ...prev, status: data.status };
           });
        }
      } catch (e) {}
    }, 10000); 

    return () => clearInterval(interval);
  }, [bankOrder, router, addToast]);

  useEffect(() => {
    if (!usdtOrder || usdtOrder.status === "COMPLETED" || usdtOrder.status === "EXPIRED") return;

    const interval = setInterval(async () => {
      try {
        const orderId = usdtOrder.orderId || usdtOrder.id;
        const res = await fetch(`/api/top-up/usdt/${orderId}`);
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.status === "COMPLETED") {
           setUsdtOrder((prev: any) => ({ ...prev, status: "COMPLETED" }));
           addToast("success", "Hệ thống đã nhận được tiền. Đã cộng số dư!");
           router.refresh();
           clearInterval(interval);
        } else if (data.status === "EXPIRED") {
           setUsdtOrder((prev: any) => ({ ...prev, status: "EXPIRED" }));
           addToast("error", "Lệnh nạp USDT đã hết hạn do quá thời gian.");
           clearInterval(interval);
        } else {
           setUsdtOrder((prev: any) => {
               if (prev && prev.status === data.status) return prev;
               return { ...prev, status: data.status };
           });
        }
      } catch (e) {}
    }, 10000); 

    return () => clearInterval(interval);
  }, [usdtOrder, router, addToast]);

  async function handleUsdtSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const amount = Number(formData.get("amount"));

    if (amount < 5) {
      addToast("error", "Số tiền nạp tối thiểu là 5 USDT.");
      return;
    }

    setLoadingUsdt(true);
    try {
      const res = await fetch("/api/top-up/usdt/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network: usdtNetwork, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tạo lệnh thất bại");
      
      setUsdtOrder(data);
      addToast("success", "Tạo lệnh hoàn tất! Vui lòng chuyển USDT.");
    } catch (e: any) {
      addToast("error", e.message);
    } finally {
      setLoadingUsdt(false);
    }
  }

  async function handleBankSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const amount = Number(formData.get("amount"));

    if (!selectedAdminId) {
      addToast("error", "Vui lòng chọn ngân hàng / tài khoản nhận."); return;
    }
    if (amount < 10000) {
      addToast("error", "Số lượng VNĐ tối thiểu là 10,000đ."); return;
    }

    setLoadingBank(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const response = await fetch("/api/top-up/bank/create", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "X-Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify({ amount, adminId: selectedAdminId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Tạo lệnh thất bại.");
      
      setBankOrder(data);
      addToast("success", "Đã khởi tạo lệnh Bank! Vui lòng chuyển khoản.");
    } catch (error: any) {
      addToast("error", error.message);
    } finally {
      setLoadingBank(false);
    }
  }

  const complaintInputRef = useRef<HTMLInputElement>(null);

  async function handleActionBank(action: 'confirm' | 'complain' | 'cancel') {
      if (action === 'complain') {
          complaintInputRef.current?.click();
          return;
      }

      const orderId = bankOrder.orderId || bankOrder.id;
      const res = await fetch(`/api/top-up/bank/${orderId}/${action}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
          if (action === 'cancel') {
             addToast("success", "Đã huỷ lệnh thành công.");
             return;
          }
          addToast("success", "Đã gửi xác nhận. Chờ admin duyệt!");
          setBankOrder((prev: any) => ({ ...prev, status: "TRANSFERRED", updatedAt: new Date().toISOString() }));
      } else {
          addToast("error", data.error || "Lỗi xử lý");
      }
  }

  async function handleComplaintFile(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
          addToast("error", "Vui lòng chọn file ảnh hợp lệ.");
          return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
          addToast("error", "Vui lòng chọn ảnh dưới 10MB.");
          return;
      }

      addToast("success", "Đang xử lý ảnh...");

      const reader = new FileReader();
      reader.onloadend = () => {
          const img = document.createElement("img");
          img.onload = async () => {
              const canvas = document.createElement("canvas");
              const MAX_WIDTH = 1000;
              const MAX_HEIGHT = 1000;
              let width = img.width;
              let height = img.height;

              if (width > height) {
                  if (width > MAX_WIDTH) {
                      height = Math.round(height * MAX_WIDTH / width);
                      width = MAX_WIDTH;
                  }
              } else {
                  if (height > MAX_HEIGHT) {
                      width = Math.round(width * MAX_HEIGHT / height);
                      height = MAX_HEIGHT;
                  }
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext("2d");
              if (!ctx) return;
              ctx.drawImage(img, 0, 0, width, height);
              
              // Nén thành JPEG 70% quality, tự động lọc sạch các mã độc EXIF/XSS
              const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);

              const orderId = bankOrder.orderId || bankOrder.id;
              try {
                  const res = await fetch(`/api/top-up/bank/${orderId}/complain`, { 
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ image: compressedBase64 })
                  });
                  
                  const data = await res.json();
                  if (res.ok) {
                      addToast("success", "Đã gửi khiếu nại cùng hình ảnh thành công! Ban Quản Trị sẽ xử lý.");
                      setBankOrder((prev: any) => ({ ...prev, status: "COMPLAINED" }));
                  } else {
                      addToast("error", data.error || "Lỗi tải ảnh lên.");
                  }
              } catch (err) {
                  addToast("error", "Lỗi đường truyền.");
              }
              if (complaintInputRef.current) complaintInputRef.current.value = "";
          };
          img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
  }

  const copyToClipboard = (text: string, message: string) => {
      navigator.clipboard.writeText(text);
      addToast("success", message);
  };

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
     const timer = setInterval(() => setNow(Date.now()), 1000);
     return () => clearInterval(timer);
  }, []);

  return (
    <div className="panel rounded-[1.75rem] p-6 shadow-sm flex flex-col space-y-6">
      <input 
          type="file" 
          accept="image/*" 
          ref={complaintInputRef} 
          style={{ display: 'none' }} 
          onChange={handleComplaintFile} 
      />
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Nạp tiền vào hệ thống</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">Chọn phương thức phù hợp với bạn.</p>
      </div>

      <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
         <button
            onClick={() => setMethod("USDT")}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${method === "USDT" ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"}`}
          >
            Crypto (USDT) / Tự động
         </button>
         <button
            onClick={() => setMethod("VND")}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${method === "VND" ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"}`}
          >
            Bank / Nội bộ (VNĐ)
         </button>
      </div>
      
      {method === "VND" && !bankOrder && (
        <form onSubmit={handleBankSubmit} className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
           {bankConfigs.length === 0 ? (
               <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600 dark:bg-rose-900/20 dark:border-rose-900/50">
                  Hệ thống nạp Bank hiện đang bảo trì, vui lòng quay lại sau hoặc sử dụng nạp Crypto!
               </div>
           ) : (
               <>
                 <div className="space-y-2">
                   <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Chọn cổng nạp (Admin):</p>
                   <select 
                      value={selectedAdminId || ""} 
                      onChange={e => setSelectedAdminId(Number(e.target.value))}
                      className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-950 px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                   >
                     {bankConfigs.map(c => (
                        <option key={c.adminId} value={c.adminId}>Admin {c.adminName} - Ngân hàng {c.bankName}</option>
                     ))}
                   </select>
                 </div>

                 <div className="space-y-2">
                   <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Nạp nhanh:</p>
                   <div className="flex flex-wrap gap-2">
                     {presetsVnd.map((preset) => (
                       <button
                         key={preset.value} type="button" onClick={() => handlePresetVnd(preset.value)}
                         className="rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:border-emerald-700 dark:hover:bg-emerald-900/40"
                       >
                         {preset.label}
                       </button>
                     ))}
                   </div>
                 </div>

                 <label className="block space-y-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                   <span>Số lượng VNĐ cần nạp <span className="text-rose-500">*</span></span>
                   <input ref={bankInputRef} name="amount" type="number" min={10000} step={1000} required placeholder="Tối thiểu: 10,000" className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-950 px-4 py-3 text-slate-900 dark:text-white outline-none transition focus:border-emerald-500"/>
                 </label>

                 <button type="submit" disabled={loadingBank} className="w-full sm:w-auto rounded-2xl bg-slate-900 dark:bg-white px-8 py-4 text-sm font-semibold text-white dark:text-slate-900 transition hover:bg-slate-800 dark:hover:bg-slate-200 active:scale-[0.98] disabled:opacity-60 shadow-lg">
                   {loadingBank ? "Đang xử lý..." : "Khởi tạo lệnh nạp Bank"}
                 </button>
               </>
           )}
        </form>
      )}

      {method === "VND" && bankOrder && ['PENDING', 'TRANSFERRED', 'COMPLAINED'].includes(bankOrder.status) && (
         <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50/50 p-5 lg:p-6 dark:border-emerald-500/50 dark:bg-emerald-950/20 animate-in fade-in duration-300 shadow-md">
            <div className="flex items-center gap-3">
               <Loader2 className="animate-spin text-emerald-600 dark:text-emerald-400" />
               <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
                  {bankOrder.status === 'PENDING' ? "Bạn cần thực hiện chuyển khoản..." : 
                   bankOrder.status === 'TRANSFERRED' ? "Đang chờ Admin duyệt..." : "Giao dịch đang bị khiếu nại!"}
               </h3>
            </div>
            
            <div className="mt-5 space-y-3">
               <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Số tiền cần chuyển chính xác</p>
                  <p className="font-mono text-3xl font-black text-emerald-600 dark:text-emerald-400">{new Intl.NumberFormat('vi-VN').format(bankOrder.amount)} VNĐ</p>
               </div>

               <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900 border border-slate-100 dark:border-slate-800 grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                      <p className="text-xs text-slate-500 uppercase tracking-widest">Ngân hàng</p>
                      <p className="font-bold">{bankOrder.adminInfo?.bankName}</p>
                  </div>
                  <div className="space-y-1">
                      <p className="text-xs text-slate-500 uppercase tracking-widest">Chi nhánh</p>
                      <p className="font-medium text-sm">{bankOrder.adminInfo?.branch || "Không ghi rõ"}</p>
                  </div>
                  <div className="space-y-1">
                      <p className="text-xs text-slate-500 uppercase tracking-widest">Chủ tài khoản</p>
                      <p className="font-bold">{bankOrder.adminInfo?.accountName}</p>
                  </div>
                  <div className="space-y-1">
                      <p className="text-xs text-slate-500 uppercase tracking-widest">Số tài khoản</p>
                      <div className="flex items-center gap-2">
                        <p className="font-mono font-black text-emerald-700 dark:text-emerald-400">{bankOrder.adminInfo?.accountNumber}</p>
                        <button onClick={() => copyToClipboard(bankOrder.adminInfo?.accountNumber || "", "Đã copy STK")} className="text-slate-400 hover:text-slate-800"><Copy size={16}/></button>
                      </div>
                  </div>
                  {bankOrder.adminInfo?.contactInfo && (
                  <div className="sm:col-span-2 space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
                      <p className="text-xs text-slate-500 uppercase tracking-widest">Liên hệ hỗ trợ</p>
                      <p className="font-medium text-sm">{bankOrder.adminInfo?.contactInfo}</p>
                  </div>
                  )}
               </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
               {bankOrder.status === 'PENDING' && (
                  <button onClick={() => handleActionBank('confirm')} className="w-full rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-emerald-700 transition active:scale-95 shadow-md">
                      Tôi đã chuyển khoản
                  </button>
               )}
               {bankOrder.status === 'TRANSFERRED' && (
                  (() => {
                     const updatedTime = bankOrder.updatedAt ? new Date(bankOrder.updatedAt).getTime() : Date.now();
                     const complainTime = updatedTime + 15 * 60 * 1000;
                     const canComplain = now >= complainTime;
                     const remainingMs = Math.max(0, complainTime - now);
                     const remainingMins = Math.floor(remainingMs / 60000);
                     const remainingSecs = Math.floor((remainingMs % 60000) / 1000);
                     
                     return (
                      <button 
                         onClick={() => canComplain && handleActionBank('complain')} 
                         disabled={!canComplain}
                         className={`w-full rounded-xl px-6 py-3.5 text-sm font-bold text-white transition shadow-md ${canComplain ? 'bg-amber-500 hover:bg-amber-600 active:scale-95' : 'bg-slate-400 cursor-not-allowed opacity-80'}`}>
                          {canComplain ? "Khiếu nại (Đính kèm ảnh CK)" : `Mở Khiếu nại sau ${remainingMins}:${remainingSecs.toString().padStart(2, '0')}`}
                      </button>
                     );
                  })()
               )}
               {(bankOrder.status === 'PENDING' || bankOrder.status === 'TRANSFERRED') && (
                  <button onClick={() => {
                        handleActionBank('cancel').then(() => setBankOrder(null));
                  }} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-3.5 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95">
                      Huỷ lệnh / Quay lại
                  </button>
               )}
            </div>
         </div>
      )}

      {method === "USDT" && !usdtOrder && (
         <form onSubmit={handleUsdtSubmit} className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
           <div className="space-y-3">
             <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Mạng chuyển (Network):</p>
             <div className="flex gap-3">
                <button type="button" onClick={() => setUsdtNetwork("BSC")} className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition ${usdtNetwork === "BSC" ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 shadow-sm" : "border-slate-200 text-slate-500 hover:border-amber-200 dark:border-slate-800 dark:text-slate-400"}`}>BNB Smart Chain (BEP20)</button>
                <button type="button" onClick={() => setUsdtNetwork("TRX")} className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition ${usdtNetwork === "TRX" ? "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400 shadow-sm" : "border-slate-200 text-slate-500 hover:border-rose-300 dark:border-slate-800 dark:text-slate-400"}`}>Tron (TRC20)</button>
             </div>
           </div>

           <div className="space-y-2">
             <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Chọn lượng USDT (Tối thiểu 5 USDT):</p>
             <div className="flex flex-wrap gap-2">
               {presetsUsdt.map((preset) => (
                 <button
                   key={preset.value} type="button" onClick={() => handlePresetUsdt(preset.value)}
                   className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 shadow-xs"
                 >
                   {preset.label}
                 </button>
               ))}
             </div>
           </div>

           <label className="block space-y-2 text-sm font-medium text-slate-700 dark:text-slate-300">
             <span>Số lượng USDT</span>
             <input ref={usdtInputRef} name="amount" type="number" min={5} step={1} required placeholder="Ví dụ: 50" className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-950 px-4 py-3 text-slate-900 dark:text-white outline-none transition focus:border-amber-500"/>
           </label>

           <button type="submit" disabled={loadingUsdt} className="w-full sm:w-auto rounded-2xl bg-amber-500 px-8 py-4 text-sm font-bold text-white transition hover:bg-amber-600 active:scale-[0.98] disabled:opacity-60 shadow-lg shadow-amber-200 dark:shadow-none">
             {loadingUsdt ? "Đang tạo lệnh..." : "Xác nhận & Lấy thông tin thanh toán"}
           </button>
         </form>
      )}

      {method === "USDT" && usdtOrder && usdtOrder.status === "PENDING" && (
         <div className="rounded-2xl border-2 border-amber-500 bg-amber-50/50 p-5 lg:p-6 dark:border-amber-500/50 dark:bg-amber-950/20 animate-in fade-in duration-300 shadow-md">
            <div className="flex items-center gap-3">
               <Loader2 className="animate-spin text-amber-600 dark:text-amber-400" />
               <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100">Đang chờ bạn thực hiện thanh toán...</h3>
            </div>
            
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
               Hãy dùng ví cá nhân hoặc sàn (Binance, OKX,...) chuyển <b>ĐÚNG CHÍNH XÁC số lượng bao gồm số thập phân</b> dưới đây. Tố độ duyệt hoàn toàn tự động chỉ mất 1-3 phút.
            </p>
            
            <div className="mt-5 space-y-3">
               <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900 flex justify-between items-center border border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Mạng lưới</p>
                  <p className="font-mono text-sm font-bold text-slate-800 dark:text-amber-300/80 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-md">{usdtOrder.network === "BSC" ? "BNB Smart Chain (BSC/BEP20)" : "Tron (TRC20)"}</p>
               </div>

               <div className="rounded-xl bg-white p-5 shadow-sm dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-4">Quét mã QR hoặc Copy Địa chỉ</p>
                  
                  <div className="flex flex-col items-center gap-5">
                    <div className="shrink-0 bg-white p-3 rounded-2xl ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm relative group w-max">
                       <img 
                          src={`https://quickchart.io/qr?size=200&margin=0&text=${usdtOrder.address}`} 
                          alt="QR Code" 
                          className="w-40 h-40 object-contain rounded-xl transition-transform duration-300 group-hover:scale-105"
                       />
                    </div>
                    <div className="w-full flex-1 flex flex-col gap-3">
                       <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800/80 w-full overflow-hidden">
                         <p className="font-mono text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 break-all">{usdtOrder.address}</p>
                         <button onClick={() => copyToClipboard(usdtOrder.address, "Đã copy ví")} className="ml-3 p-2 shrink-0 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 active:scale-95 transition shadow-sm border border-slate-100 dark:border-slate-700">
                             <Copy size={18} />
                         </button>
                       </div>
                       <p className="text-sm text-center text-slate-500 font-medium bg-amber-50/50 dark:bg-amber-900/20 p-2.5 rounded-lg border border-amber-100 dark:border-amber-900/50">Lưu ý: Mạng <strong className="text-amber-600 dark:text-amber-400 uppercase">{usdtOrder.network === "BSC" ? "BSC (BEP20)" : "Tron (TRC20)"}</strong>. Nạp sai mạng sẽ mất tài sản!</p>
                    </div>
                  </div>
               </div>

               <div className="rounded-xl bg-amber-100/80 border border-amber-300 p-5 shadow-sm dark:bg-amber-900/40 dark:border-amber-800/50 relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-amber-400/20 dark:bg-amber-400/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5 opacity-90">
                     <AlertCircle size={16}/> LƯỢNG USDT PHẢI CHUYỂN
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-3">
                    <p className="font-mono text-4xl font-black text-amber-600 dark:text-amber-400 tracking-tight">{usdtOrder.expectedAmount}</p>
                    <button onClick={() => copyToClipboard(usdtOrder.expectedAmount.toString(), "Đã copy số tiền")} className="p-3 shrink-0 rounded-xl bg-amber-500 hover:bg-amber-600 text-white active:scale-95 transition shadow-md shadow-amber-500/30 flex justify-center items-center gap-2 font-medium text-sm">
                        <Copy size={18} /> Copy số
                    </button>
                  </div>
               </div>
            </div>

            <div className="mt-6 flex justify-center">
               <button onClick={() => setUsdtOrder(null)} className="text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 underline underline-offset-4 transition">
                  Huỷ bỏ hoặc tạo lại lệnh khác
               </button>
            </div>
         </div>
      )}

      {method === "USDT" && usdtOrder && usdtOrder.status === "COMPLETED" && (
         <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-8 text-center animate-in fade-in duration-300 dark:bg-emerald-950/20 dark:border-emerald-500/50 shadow-emerald-500/10 shadow-xl">
            <CheckCircle2 className="mx-auto text-emerald-500 mb-4" size={56} />
            <h3 className="text-2xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight">Thanh Toán Thành Công!</h3>
            <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-500/80">Hệ thống đã nhận được tiền và cộng vào ví của bạn.</p>
            <button onClick={() => setUsdtOrder(null)} className="mt-8 rounded-xl bg-emerald-600 px-8 py-3.5 text-sm font-bold text-white hover:bg-emerald-700 transition active:scale-95 shadow-lg shadow-emerald-500/30">
                Tiếp tục mua sắm
            </button>
         </div>
      )}

      {method === "USDT" && usdtOrder && usdtOrder.status === "EXPIRED" && (
         <div className="rounded-2xl border-2 border-rose-500 bg-rose-50 p-8 text-center animate-in fade-in duration-300 dark:bg-rose-950/20 dark:border-rose-500/50">
            <AlertCircle className="mx-auto text-rose-500 mb-4" size={56} />
            <h3 className="text-2xl font-black text-rose-700 dark:text-rose-400 tracking-tight">Lệnh Đã Hết Hạn</h3>
            <p className="mt-3 text-sm text-rose-600 dark:text-rose-500/80">Quá thời gian 30 phút. Vui lòng tạo lệnh mới nếu bạn chưa chuyển tiền.</p>
            <button onClick={() => setUsdtOrder(null)} className="mt-8 rounded-xl bg-slate-900 px-8 py-3.5 text-sm font-bold text-white hover:bg-slate-800 transition active:scale-95 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
                Tạo lệnh nạp mới
            </button>
         </div>
      )}
    </div>
  );
}
