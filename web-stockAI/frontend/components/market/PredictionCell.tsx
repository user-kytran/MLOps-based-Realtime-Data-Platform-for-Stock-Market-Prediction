// components/PredictionCell.tsx
"use client"

import { Icons } from "@/components/icons"
import { cn } from "@/lib/utils" // Giả sử bạn có hàm helper `cn`

interface PredictionCellProps {
  // Dữ liệu dự đoán bạn nhận được (ví dụ: từ API hoặc model)
  trend: "up" | "down" | "neutral" | null | undefined;
  confidence?: number;
  className?: string;
}

export const PredictionCell = ({ trend, confidence, className }: PredictionCellProps) => {
  const wrapperClass = "flex h-6 w-full max-w-full min-w-0 items-center justify-center overflow-hidden px-0.5";

  let icon;
  let colorClass;

  switch (trend) {
    case "up":
      // Sử dụng icon 'TrendingUp' từ file của bạn
      icon = <Icons.TrendingUp className="h-3.5 w-3.5 shrink-0 stroke-[2.5]" />;
      colorClass = "border border-green-200 bg-green-50 text-green-600"; // Đồng bộ với màu tăng trong bảng
      break;
    case "down":
      // Sử dụng icon 'TrendingDown' từ file của bạn
      icon = <Icons.TrendingDown className="h-3.5 w-3.5 shrink-0 stroke-[2.5]" />;
      colorClass = "border border-red-200 bg-red-50 text-red-600"; // Đồng bộ với màu giảm trong bảng
      break;
    case "neutral":
      // Sử dụng icon 'Minus' từ file của bạn
      icon = <Icons.Minus className="h-3.5 w-3.5 shrink-0 stroke-[3]" />;
      colorClass = "border border-gray-200 bg-gray-50 text-gray-600"; // Màu xám cho "đi ngang"
      break;
    default:
      // Hiển thị khi không có dữ liệu dự đoán
      return (
        <div className={cn(wrapperClass, className)}>
          <span className="text-gray-400 text-sm">—</span>
        </div>
      );
  }

  return (
    <div className={cn(wrapperClass, colorClass, "rounded-md", className)}>
      <div className="flex min-w-0 max-w-full items-center justify-center gap-0.5 text-[10px]">
        {icon}
        <span className="min-w-0 truncate text-center font-extrabold leading-none">
          {trend === "up" ? "UP" : trend === "down" ? "DOWN" : "—"}
        </span>
      </div>
    </div>
  );
};
