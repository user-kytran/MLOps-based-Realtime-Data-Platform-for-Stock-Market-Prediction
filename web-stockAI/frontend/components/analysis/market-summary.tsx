"use client"

import { useStocksRealtimeWS } from "@/hooks/useStocksRealtimeWS"
import { usePredictions } from "@/hooks/usePredictions"
import { AnalysisPanel, MetricTile } from "./analysis-ui"

export function MarketSummary() {
  const stocks = useStocksRealtimeWS()
  const predictions = usePredictions()

  const advancing = stocks.filter(s => s.match.change > 0).length
  const declining = stocks.filter(s => s.match.change < 0).length
  const unchanged = stocks.filter(s => s.match.change === 0).length
  const totalStocks = stocks.length || 1
  const totalVolume = stocks.reduce((sum, s) => sum + (s.match.volume || 0), 0)
  const avgChange = stocks.length
    ? stocks.reduce((sum, s) => sum + s.match.change_percent, 0) / stocks.length
    : 0
  const totalPredictions = Object.keys(predictions).length

  const advancingPct = ((advancing / totalStocks) * 100).toFixed(1)
  const decliningPct = ((declining / totalStocks) * 100).toFixed(1)
  const unchangedPct = ((unchanged / totalStocks) * 100).toFixed(1)

  const stats = [
    { 
      label: "Total Stocks", 
      value: totalStocks.toString(), 
      subtext: `${totalPredictions} AI covered`,
      tone: "accent" as const,
    },
    { 
      label: "Bullish", 
      value: `+${advancing}`, 
      subtext: `${advancingPct}% of market`,
      tone: "positive" as const,
    },
    { 
      label: "Bearish", 
      value: `-${declining}`, 
      subtext: `${decliningPct}% of market`,
      tone: "negative" as const,
    },
    { 
      label: "Unchanged", 
      value: unchanged.toString(), 
      subtext: `${unchangedPct}% flat`,
      tone: "neutral" as const,
    },
    { 
      label: "Total Volume", 
      value: `${(totalVolume / 1_000_000).toFixed(1)}M`, 
      subtext: "Shares traded",
      tone: "accent" as const,
    },
    { 
      label: "Average Change", 
      value: `${avgChange >= 0 ? "+" : ""}${avgChange.toFixed(2)}%`, 
      subtext: "Equal-weighted",
      tone: avgChange > 0 ? "positive" as const : avgChange < 0 ? "negative" as const : "neutral" as const,
    }
  ]

  return (
    <AnalysisPanel title="Market Summary" eyebrow="Live breadth">
      <div className="space-y-3">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
          {stats.map((stat, i) => (
            <MetricTile
              key={i}
              label={stat.label}
              value={stat.value}
              subtext={stat.subtext}
              tone={stat.tone}
            />
          ))}
        </div>

        {/* Market Breadth Proportion Bar */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-1.5 text-green-700 font-bold">
              <span className="h-2.5 w-2.5 rounded-full bg-green-600" />
              Bullish ({advancing}) · {advancingPct}%
            </span>
            <span className="text-slate-500 font-medium">
              Unchanged ({unchanged}) · {unchangedPct}%
            </span>
            <span className="flex items-center gap-1.5 text-red-700 font-bold">
              Bearish ({declining}) · {decliningPct}%
              <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
            </span>
          </div>
          <div className="h-2.5 w-full bg-slate-200 rounded-full flex overflow-hidden">
            <div
              style={{ width: `${(advancing / totalStocks) * 100}%` }}
              className="bg-green-600 transition-all duration-300"
              title={`Bullish: ${advancing}`}
            />
            <div
              style={{ width: `${(unchanged / totalStocks) * 100}%` }}
              className="bg-slate-300 transition-all duration-300"
              title={`Unchanged: ${unchanged}`}
            />
            <div
              style={{ width: `${(declining / totalStocks) * 100}%` }}
              className="bg-red-600 transition-all duration-300"
              title={`Bearish: ${declining}`}
            />
          </div>
        </div>
      </div>
    </AnalysisPanel>
  )
}
