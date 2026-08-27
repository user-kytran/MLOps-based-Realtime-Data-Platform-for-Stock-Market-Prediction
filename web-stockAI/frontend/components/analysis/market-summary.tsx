"use client"

import { useStocksRealtimeWS } from "@/hooks/useStocksRealtimeWS"
import { usePredictions } from "@/hooks/usePredictions"
import { TrendingUp, TrendingDown, Minus, Database } from "lucide-react"
import { AnalysisPanel, MetricTile } from "./analysis-ui"

export function MarketSummary() {
  const stocks = useStocksRealtimeWS()
  const predictions = usePredictions()

  const advancing = stocks.filter(s => s.match.change > 0).length
  const declining = stocks.filter(s => s.match.change < 0).length
  const unchanged = stocks.filter(s => s.match.change === 0).length
  const totalVolume = stocks.reduce((sum, s) => sum + (s.match.volume || 0), 0)
  const avgChange = stocks.length
    ? stocks.reduce((sum, s) => sum + s.match.change_percent, 0) / stocks.length
    : 0
  const totalPredictions = Object.keys(predictions).length

  const stats = [
    { 
      label: "Total Stocks", 
      value: totalPredictions, 
      tone: "accent" as const,
      icon: Database,
    },
    { 
      label: "Bullish", 
      value: advancing, 
      tone: "positive" as const,
      icon: TrendingUp,
    },
    { 
      label: "Bearish", 
      value: declining, 
      tone: "negative" as const,
      icon: TrendingDown,
    },
    { 
      label: "Unchanged", 
      value: unchanged, 
      tone: "amber" as const,
      icon: Minus,
    },
    { 
      label: "Total Volume", 
      value: `${(totalVolume / 1000000).toFixed(1)}M`, 
      tone: "neutral" as const,
    },
    { 
      label: "Average Change", 
      value: `${avgChange.toFixed(2)}%`, 
      tone: avgChange > 0 ? "positive" as const : avgChange < 0 ? "negative" as const : "neutral" as const,
    }
  ]

  return (
    <AnalysisPanel title="Market Summary" eyebrow="Live breadth">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {stats.map((stat, i) => (
            <MetricTile
              key={i}
              label={stat.label}
              value={stat.value}
              tone={stat.tone}
              icon={stat.icon ? <stat.icon className="h-4 w-4" /> : undefined}
            />
          ))}
        </div>
    </AnalysisPanel>
  )
}
