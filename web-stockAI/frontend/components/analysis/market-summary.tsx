"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useStocksRealtimeWS } from "@/hooks/useStocksRealtimeWS"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

export function MarketSummary() {
  const stocks = useStocksRealtimeWS()

  const advancing = stocks.filter(s => s.match.change > 0).length
  const declining = stocks.filter(s => s.match.change < 0).length
  const unchanged = stocks.filter(s => s.match.change === 0).length
  const totalVolume = stocks.reduce((sum, s) => sum + (s.match.volume || 0), 0)
  const avgChange = stocks.reduce((sum, s) => sum + s.match.change_percent, 0) / stocks.length

  const stats = [
    { 
      label: "Advancing", 
      value: advancing, 
      color: "text-green-600",
      icon: TrendingUp,
      bg: "bg-green-100"
    },
    { 
      label: "Declining", 
      value: declining, 
      color: "text-red-600",
      icon: TrendingDown,
      bg: "bg-red-100"
    },
    { 
      label: "Unchanged", 
      value: unchanged, 
      color: "text-yellow-600",
      icon: Minus,
      bg: "bg-yellow-100"
    },
    { 
      label: "Total Volume", 
      value: `${(totalVolume / 1000000).toFixed(1)}M`, 
      color: "text-blue-600",
      bg: "bg-blue-100"
    },
    { 
      label: "Average Change", 
      value: `${avgChange.toFixed(2)}%`, 
      color: avgChange > 0 ? "text-green-600" : "text-red-600",
      bg: avgChange > 0 ? "bg-green-100" : "bg-red-100"
    }
  ]

  return (
    <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-gray-900 text-xl">Market Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 justify-center">
          {stats.map((stat, i) => (
            <div key={i} className={`${stat.bg} rounded-lg p-4 border border-gray-200`}>
              <div className="flex items-center gap-2 mb-2 justify-center text-[16px]">
                {stat.icon && <stat.icon className={`h-4 w-4 ${stat.color}`} />}
                <p className="text-gray-600 text-xs text-center font-bold text-[14px]">{stat.label}</p>
              </div>
              <p className={`${stat.color} text-2xl font-bold text-center font-mono text-[30px]`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

