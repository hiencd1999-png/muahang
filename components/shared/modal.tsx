"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "small" | "medium" | "large";
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "medium",
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !isMounted) return null;

  const sizeClasses = {
    small: "max-w-sm",
    medium: "max-w-2xl",
    large: "max-w-6xl",
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="min-h-screen px-3 py-4 sm:px-6 sm:py-8 lg:px-8 flex items-center justify-center">
        <div
          ref={modalRef}
          className={`bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl max-h-[94vh] w-full min-w-0 overflow-x-hidden overflow-y-auto ${sizeClasses[size]} animate-rise border dark:border-slate-700/80`}
        >
          {title && (
            <div className="flex items-center justify-between border-b dark:border-slate-700/80 p-6">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                aria-label="Close modal"
              >
                <X size={24} className="text-slate-500 dark:text-slate-300" />
              </button>
            </div>
          )}
          <div className="min-w-0 overflow-x-hidden p-6">{children}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}
