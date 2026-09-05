// components/PredictionCell.tsx
"use client"

import { cn } from "@/lib/utils"

interface PredictionCellProps {
  trend: "up" | "down" | "neutral" | null | undefined;
  confidence?: number;
  className?: string;
}

export const PredictionCell = ({ trend, confidence, className }: PredictionCellProps) => {
  const wrapperClass = "flex h-6 w-full max-w-full min-w-0 items-center justify-center overflow-hidden px-0.5 rounded-md text-[10px]";

  if (trend === "up") {
    return (
      <div className={cn(wrapperClass, "border border-green-200 bg-green-50 text-green-700", className)}>
        <span className="min-w-0 truncate text-center font-bold tracking-wide leading-none">
          UP
        </span>
      </div>
    );
  }

  if (trend === "down") {
    return (
      <div className={cn(wrapperClass, "border border-red-200 bg-red-50 text-red-700", className)}>
        <span className="min-w-0 truncate text-center font-bold tracking-wide leading-none">
          DOWN
        </span>
      </div>
    );
  }

  if (trend === "neutral") {
    return (
      <div className={cn(wrapperClass, "border border-slate-200 bg-slate-100 text-slate-600", className)}>
        <span className="min-w-0 truncate text-center font-bold tracking-wide leading-none">
          FLAT
        </span>
      </div>
    );
  }

  // N/A - Clean text badge matching UP/DOWN/FLAT frame
  return (
    <div
      className={cn(wrapperClass, "border border-gray-200 bg-gray-50/90 text-gray-400 cursor-help", className)}
      title="AI model currently covers the VN30 basket"
    >
      <span className="min-w-0 truncate text-center font-bold tracking-wide leading-none">
        N/A
      </span>
    </div>
  );
};
