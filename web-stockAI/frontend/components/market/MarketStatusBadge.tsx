"use client";

import { useMarketStatus } from "@/hooks/useMarketStatus";

interface MarketStatusBadgeProps {
  variant?: "compact" | "full";
  className?: string;
}

export function MarketStatusBadge({ variant = "compact", className = "" }: MarketStatusBadgeProps) {
  const { status, isLoading } = useMarketStatus();

  if (isLoading || !status) {
    return null;
  }

  if (status.is_open) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-50 border border-green-200/80 text-green-700 text-[11px] font-semibold tracking-wide shadow-xs ${className}`}
        title={`Phiên giao dịch: ${status.label} (${status.session})`}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
        <span>{variant === "compact" ? (status.status_code === "ATO" ? "ATO" : status.status_code === "ATC" ? "ATC" : "LIVE") : status.label}</span>
      </div>
    );
  }

  if (status.status_code === "LUNCH_BREAK") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200/80 text-amber-700 text-[11px] font-semibold tracking-wide shadow-xs ${className}`}
        title={status.label}
      >
        <span className="inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        <span>{variant === "compact" ? "NGHỈ TRƯA" : status.label}</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-600 text-[11px] font-medium tracking-wide shadow-xs ${className}`}
      title={status.label}
    >
      <span className="inline-flex rounded-full h-2 w-2 bg-gray-400"></span>
      <span>{variant === "compact" ? "ĐÓNG CỬA" : status.label}</span>
    </div>
  );
}

