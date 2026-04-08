"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
      <h2 className="text-2xl font-semibold text-slate-950">Có lỗi xảy ra</h2>
      <p className="mt-2 text-slate-600">Đã có lỗi không mong muốn. Vui lòng thử lại.</p>
      <button
        onClick={reset}
        className="mt-4 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
      >
        Thử lại
      </button>
    </div>
  );
}