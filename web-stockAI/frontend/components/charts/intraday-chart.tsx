"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Icons } from "@/components/icons"

interface IntradayChartProps {
  symbol: string
}

// Deterministic intraday data to avoid hydration mismatch
const generateIntradayData = (symbol: string) => {
  const basePrice = symbol === "VNM" ? 82500 : 45200
  const data = []
  
  // Use symbol as seed for consistent data
  const seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)

  for (let i = 0; i < 24; i++) {
    const hour = i + 9 // Start from 9 AM
    
    // Use deterministic "random" based on seed and hour
    const pseudoRandom = Math.sin(seed + i) * 10000
    const variation = (pseudoRandom % 0.04) - 0.02 // ±1% variation
    const price = Math.round(basePrice * (1 + variation))
    const volume = Math.round(Math.abs(pseudoRandom % 100000) + 50000)

    data.push({
      time: `${hour.toString().padStart(2, "0")}:00`,
      price,
      volume,
      change: (((price - basePrice) / basePrice) * 100).toFixed(2),
    })
  }

  return data
}

export function IntradayChart({ symbol }: IntradayChartProps) {
  const intradayData = useMemo(() => generateIntradayData(symbol), [symbol])
  const maxPrice = Math.max(...intradayData.map((d) => d.price))
  const minPrice = Math.min(...intradayData.map((d) => d.price))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icons.Clock className="h-5 w-5 text-primary" />
          Biến động giá trong ngày
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Price Chart */}
        <div className="mb-4">
          <div className="h-32 relative bg-muted/20 rounded-lg p-4">
            <svg className="w-full h-full" viewBox="0 0 800 200">
              {/* Grid lines */}
              {[0, 1, 2, 3, 4].map((i) => (
                <line key={i} x1="0" y1={i * 50} x2="800" y2={i * 50} stroke="currentColor" strokeOpacity="0.1" />
              ))}

              {/* Price line */}
              <polyline
                fill="none"
                stroke="rgb(59, 130, 246)"
                strokeWidth="2"
                points={intradayData
                  .map((point, index) => {
                    const x = (index / (intradayData.length - 1)) * 800
                    const y = 200 - ((point.price - minPrice) / (maxPrice - minPrice)) * 180
                    return `${x},${y}`
                  })
                  .join(" ")}
              />

              {/* Data points */}
              {intradayData.map((point, index) => {
                const x = (index / (intradayData.length - 1)) * 800
                const y = 200 - ((point.price - minPrice) / (maxPrice - minPrice)) * 180
                return (
                  <circle
                    key={index}
                    cx={x}
                    cy={y}
                    r="3"
                    fill="rgb(59, 130, 246)"
                    className="hover:r-5 transition-all cursor-pointer"
                  />
                )
              })}
            </svg>

            {/* Price labels */}
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-muted-foreground py-2">
              <span>{maxPrice.toLocaleString("vi-VN")}</span>
              <span>{Math.round((maxPrice + minPrice) / 2).toLocaleString("vi-VN")}</span>
              <span>{minPrice.toLocaleString("vi-VN")}</span>
            </div>
          </div>
        </div>

        {/* Summary Info */}
        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <span>Cao nhất: <span className="font-mono font-semibold text-green-600">{maxPrice.toLocaleString("vi-VN")}</span></span>
          <span>Thấp nhất: <span className="font-mono font-semibold text-red-600">{minPrice.toLocaleString("vi-VN")}</span></span>
          <span>Biến động: <span className="font-mono font-semibold">{Math.round(((maxPrice - minPrice) / minPrice) * 100 * 100) / 100}%</span></span>
        </div>
      </CardContent>
    </Card>
  )
}
