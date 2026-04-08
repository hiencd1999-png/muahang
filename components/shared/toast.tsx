"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (type: ToastType, message: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => removeToast(id), 5000); // Auto remove after 5s
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div 
      className="fixed top-4 left-4 right-4 z-[9999] flex flex-col items-center gap-2 pointer-events-none sm:left-auto sm:right-4 sm:items-end"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const bgColor = {
    success: "bg-emerald-600 shadow-emerald-500/20",
    error: "bg-rose-600 shadow-rose-500/20",
    info: "bg-sky-600 shadow-sky-500/20",
  }[toast.type];

  return (
    <div className={`${bgColor} pointer-events-auto animate-rise text-white px-5 py-3 rounded-2xl shadow-xl flex items-center justify-between w-full max-w-[calc(100vw-32px)] sm:max-w-sm border border-white/10`}>
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-sm font-medium truncate">{toast.message}</span>
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="ml-4 flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 transition"
      >
        ×
      </button>
    </div>
  );
}