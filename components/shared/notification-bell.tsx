"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";
import { useToast } from "@/components/shared/toast";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: Date;
}

export function NotificationBell() {
  const router = useRouter();
  const { addToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  async function fetchNotifications() {
    try {
      const response = await fetch("/api/user/notifications");
      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  }

  async function markAsRead(notificationId: number) {
    try {
      setLoading(true);
      const response = await fetch("/api/user/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, read: true } : n
          )
        );
        setUnreadCount(Math.max(0, unreadCount - 1));
      }
    } catch (error) {
      addToast("error", "Lỗi cập nhật thông báo");
    } finally {
      setLoading(false);
    }
  }

  function resolveNotificationLink(notif: Notification) {
    if (notif.link && notif.link.trim()) {
      const orderIdMatch = /#(\d+)/.exec(notif.title) || /#(\d+)/.exec(notif.message);
      if (notif.link.startsWith("/dashboard/orders") && orderIdMatch && !notif.link.includes("orderId=")) {
        return `/dashboard/orders?orderId=${orderIdMatch[1]}`;
      }
      return notif.link;
    }

    const fallbackOrderId = /#(\d+)/.exec(notif.title) || /#(\d+)/.exec(notif.message);
    if (fallbackOrderId) {
      return `/dashboard/orders?orderId=${fallbackOrderId[1]}`;
    }

    return "/dashboard/notifications";
  }

  async function handleNotificationClick(notif: Notification) {
    if (!notif.read) {
      await markAsRead(notif.id);
    }

    setIsOpen(false);
    router.push(resolveNotificationLink(notif));
  }

  return (
    <div className="relative z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-[0.98]"
      >
        <svg className="h-5 w-5 text-slate-700 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-rose-600 rounded-full">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && typeof document !== "undefined" && (
        <>
          {require("react-dom").createPortal(
            <>
              {/* Backdrop - Phủ toàn màn hình */}
              <div 
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[9998]"
                onClick={() => setIsOpen(false)}
              />
              
              {/* Notification Panel - Căn giữa tuyệt đối trên Mobile */}
              <div 
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-[420px] max-h-[85vh] bg-white dark:bg-slate-950 shadow-2xl z-[9999] animate-rise rounded-[2.5rem] border border-slate-200 dark:border-slate-700/80 overflow-hidden flex flex-col sm:w-[400px] sm:max-h-[600px]"
              >
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/80 p-5 sm:p-6">
                  <h3 className="font-black text-slate-900 dark:text-white text-xl tracking-tight">Thông báo</h3>
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="p-2.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <svg className="w-6 h-6 text-slate-500 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-2 sm:p-3">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                      <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6 shadow-inner">
                        <svg className="w-10 h-10 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                      </div>
                      <p className="text-slate-900 dark:text-white font-bold text-lg">Hệ thống sạch sẽ!</p>
                      <p className="text-sm text-slate-500 dark:text-slate-300 mt-2 leading-relaxed">Bạn không có thông báo nào chưa đọc lúc này.</p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`p-5 rounded-3xl hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-all mb-1 ${
                          !notif.read ? "bg-amber-50/70 dark:bg-amber-900/10" : "bg-transparent"
                        }`}
                        onClick={() => handleNotificationClick(notif)}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 shadow-sm ${!notif.read ? "bg-amber-600 animate-pulse" : "bg-slate-200 dark:bg-slate-700"}`}></div>
                          <div className="flex-1 min-w-0">
                            <p className="font-extrabold text-base text-slate-950 dark:text-slate-100 leading-snug mb-1.5">{notif.title}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">{notif.message}</p>
                            <div className="flex items-center justify-between mt-3">
                              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 border border-slate-100 dark:border-slate-700/80 px-2 py-0.5 rounded-lg whitespace-nowrap">
                                {formatDate(new Date(notif.createdAt))}
                              </span>
                              {!notif.read && (
                                <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2.5 py-1 rounded-full uppercase tracking-widest shadow-sm">Mới</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700/80 p-5 bg-slate-50/50 dark:bg-slate-800/20">
                  <a
                    href="/dashboard/notifications"
                    className="flex items-center justify-center w-full py-4 bg-amber-600 dark:bg-amber-600 text-white rounded-2xl text-base font-black shadow-lg shadow-amber-200 dark:shadow-none hover:bg-amber-700 transition-all active:scale-[0.98]"
                    onClick={() => setIsOpen(false)}
                  >
                    Tất cả thông báo
                  </a>
                </div>
              </div>
            </>,
            document.body
          )}
        </>
      )}
    </div>
  );
}
