"use client"

import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Plus } from "lucide-react"
import Link from "next/link"
import { useStockChartData } from "@/hooks/useStockChartData"

interface StockWidgetProps {
  symbol: string
  companyName: string
  price: number
  change: number
  changePercent: number
}

export function StockWidget({ 
  symbol, 
  companyName, 
  price, 
  change, 
  changePercent
}: StockWidgetProps) {
  const { chartData, loading, hasData } = useStockChartData(symbol)
  const isPositive = change >= 0
  const TrendIcon = isPositive ? TrendingUp : TrendingDown
  
  // Chỉ tạo SVG path nếu có dữ liệu
  let pathData = ""
  if (hasData && chartData.length > 0) {
    const maxValue = Math.max(...chartData)
    const minValue = Math.min(...chartData)
    const range = maxValue - minValue || 1
    
    const points = chartData.map((value, index) => {
      const x = (index / (chartData.length - 1)) * 100
      const y = 100 - ((value - minValue) / range) * 100
      return `${x},${y}`
    }).join(' ')
    
    pathData = `M ${points}`
  }

  return (
    <Link href={`/stock/${symbol}`}>
      <Card className="bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer rounded-xl border-0 shadow-sm">
        <CardContent className="py-2 px-6">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h2 className="font-extrabold text-lg text-black text-[20px]">{symbol}</h2>
            </div>
          </div>
          
          <div className="mb-3">
            <svg width="100%" height="60" viewBox="0 0 100 100" className="overflow-visible">
              {/* Đường tham chiếu */}
              <line 
                x1="0" 
                y1="50" 
                x2="100" 
                y2="50" 
                stroke="#d1d5db" 
                strokeWidth="1" 
                strokeDasharray="2,2"
              />
              {/* Biểu đồ - chỉ hiển thị nếu có dữ liệu */}
              {hasData && pathData && (
                <path
                  d={pathData}
                  fill="none"
                  stroke={isPositive ? "#10b981" : "#ef4444"}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {/* Hiển thị loading hoặc không có dữ liệu */}
              {loading && (
                <text x="50" y="50" textAnchor="middle" className="text-xs fill-gray-400">
                  Loading...
                </text>
              )}
              {!loading && !hasData && (
                <text x="50" y="50" textAnchor="middle" className="text-xs fill-gray-400">
                  No data
                </text>
              )}
            </svg>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <TrendIcon 
                className={`h-4 w-4 ${isPositive ? 'text-green-500' : 'text-red-500'}`} 
              />
              <span className={`font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
              </span>
            </div>
            <div className="text-sm text-gray-500">
              {price.toLocaleString('vi-VN')}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}