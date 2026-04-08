"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
}

export function Pagination({ currentPage, totalPages, baseUrl }: PaginationProps) {
  const searchParams = useSearchParams();

  const getPageUrl = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    return `${baseUrl}?${params.toString()}`;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-600">
        Trang <span className="font-semibold">{currentPage}</span> / <span className="font-semibold">{totalPages}</span>
      </p>

      <div className="flex items-center gap-2">
        {currentPage > 1 && (
          <Link
            href={getPageUrl(currentPage - 1)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Trước
          </Link>
        )}

        <div className="flex gap-1">
          {Array.from({ length: totalPages }).map((_, i) => {
            const page = i + 1;
            const isActive = page === currentPage;
            const isVisible = Math.abs(page - currentPage) <= 2 || page === 1 || page === totalPages;

            if (!isVisible) {
              if (page === 2) return <span key={page} className="px-2 text-slate-500">...</span>;
              return null;
            }

            return (
              <Link
                key={page}
                href={getPageUrl(page)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-amber-600 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {page}
              </Link>
            );
          })}
        </div>

        {currentPage < totalPages && (
          <Link
            href={getPageUrl(currentPage + 1)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Tiếp
          </Link>
        )}
      </div>
    </div>
  );
}