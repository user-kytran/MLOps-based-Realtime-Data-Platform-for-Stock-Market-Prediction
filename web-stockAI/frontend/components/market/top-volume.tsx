"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Icons } from "@/components/icons"
import Link from "next/link"
import { useMemo } from "react"

interface StockData {
  symbol: string
  match: {
    price: number
    volume: number
    change: number
    change_percent: number
  }
  reference: number
}

interface TopVolumeProps {
  stocks: StockData[]
}

export function TopVolume({ stocks }: TopVolumeProps) {
  const topStocks = useMemo(() => {
    if (!stocks || stocks.length === 0) return []
    
    return [...stocks]
      .filter(s => s.match.volume > 0)
      .sort((a, b) => b.match.volume - a.match.volume)
      .slice(0, 5)
  }, [stocks])

  return (
    <Card className="bg-black border-gray-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-100">
          <Icons.BarChart className="h-5 w-5 text-blue-400" />
          Top Volume
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {topStocks.map((stock, index) => (
            <div
              key={stock.symbol}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-950 hover:bg-gray-900 transition-colors cursor-pointer border border-gray-800"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-950 text-blue-400 text-xs font-bold flex items-center justify-center border border-blue-800">
                  {index + 1}
                </div>
                <div>
                  <div className={`font-bold ${
                    stock.match.change > 0
                      ? "text-green-400"
                      : stock.match.change < 0
                      ? "text-red-400"
                      : "text-gray-200"
                  }`}>
                    <Link href={`/stock/${stock.symbol}`}>{stock.symbol}</Link>
                  </div>
                  <div className="text-xs text-gray-500 font-mono">
                    {stock.match.volume.toLocaleString("vi-VN")}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`font-mono text-sm font-bold ${
                  stock.match.change > 0
                    ? "text-green-400"
                    : stock.match.change < 0
                    ? "text-red-400"
                    : "text-gray-400"
                }`}>
                  {stock.match.price.toLocaleString("vi-VN")}
                </div>
                <div className={`text-xs font-mono ${
                  stock.match.change_percent > 0
                    ? "text-green-400"
                    : stock.match.change_percent < 0
                    ? "text-red-400"
                    : "text-gray-500"
                }`}>
                  {stock.match.change_percent > 0 ? "+" : ""}
                  {stock.match.change_percent}%
                </div>
              </div>
            </div>
          ))}
          
          {topStocks.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No data
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

