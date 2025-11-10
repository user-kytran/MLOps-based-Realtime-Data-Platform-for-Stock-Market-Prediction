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
  const wrapperClass = "flex items-center justify-center h-full w-[120px]";

  // Thêm hiệu ứng "pulse" nhẹ để làm nó "sinh động"
  const pulseClass = "animate-pulse"; 

  let icon;
  let colorClass;

  switch (trend) {
    case "up":
      // Sử dụng icon 'TrendingUp' từ file của bạn
      icon = <Icons.TrendingUp className="h-6 w-6 stroke-[2.5]" />;
      colorClass = "text-green-500 bg-green-100"; // Màu xanh lá cho "tăng"
      break;
    case "down":
      // Sử dụng icon 'TrendingDown' từ file của bạn
      icon = <Icons.TrendingDown className="h-6 w-6 stroke-[2.5]" />;
      colorClass = "text-red-500 bg-red-100"; // Màu đỏ cho "giảm"
      break;
    case "neutral":
      // Sử dụng icon 'Minus' từ file của bạn
      icon = <Icons.Minus className="h-6 w-6 stroke-[3]" />; 
      colorClass = "text-gray-500 bg-gray-100"; // Màu xám cho "đi ngang"
      break;
    default:
      // Hiển thị khi không có dữ liệu dự đoán
      return (
        <div className={cn(wrapperClass, className)}>
          <span className="text-gray-400 text-xl">—</span>
        </div>
      );
  }

  return (
    <div className={cn(wrapperClass, colorClass, pulseClass, "rounded-md", className)}>
      <div className="flex items-center gap-2 text-[14px] min-w-[80px] justify-center">
        <div className="w-6 flex justify-center">{icon}</div>
        <span className="font-bold w-12 text-center">
          {trend === "up" ? "UP" : trend === "down" ? "DOWN" : "—"}
        </span>
      </div>
    </div>
  );
};