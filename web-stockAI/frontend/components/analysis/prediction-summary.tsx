"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { usePredictions } from "@/hooks/usePredictions"
import { AnalysisPanel, chartColors, tooltipStyle } from "./analysis-ui"

const COLORS = {
  up: chartColors.positive,
  down: chartColors.negative,
  neutral: "#94a3b8"
}

export function PredictionSummary() {
  const predictions = usePredictions()

  const stats = Object.values(predictions).reduce(
    (acc, pred) => {
      if (pred.predictionTrend === 'up') acc.up++
      else if (pred.predictionTrend === 'down') acc.down++
      else acc.neutral++
      return acc
    },
    { up: 0, down: 0, neutral: 0 }
  )

  const total = stats.up + stats.down + stats.neutral || 1

  const chartData = [
    { name: 'Bullish', value: stats.up, color: COLORS.up },
    { name: 'Bearish', value: stats.down, color: COLORS.down },
    { name: 'Unchanged', value: stats.neutral, color: COLORS.neutral }
  ].filter(d => d.value > 0)

  const upPct = ((stats.up / total) * 100).toFixed(1)
  const downPct = ((stats.down / total) * 100).toFixed(1)
  const neutralPct = ((stats.neutral / total) * 100).toFixed(1)

  return (
    <AnalysisPanel
      title="Today's Market Prediction"
      eyebrow={`${total} tracked signals`}
      action={
        <span className="inline-flex items-center text-xs font-semibold text-cyan-800 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-md">
          Consensus
        </span>
      }
    >
      <div className="flex flex-col justify-between h-full gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr] items-center">
          {/* Donut Chart with center summary */}
          <div className="relative h-[180px] w-[180px] mx-auto flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={78}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string) => {
                    const percentage = ((value / total) * 100).toFixed(1)
                    return [`${value} stocks (${percentage}%)`, name]
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-extrabold font-mono text-slate-800 leading-tight">{total}</span>
              <span className="text-[11px] font-semibold text-slate-500">Symbols</span>
            </div>
          </div>

          {/* Detailed Indicator Rows */}
          <div className="space-y-2.5">
            {/* Bullish */}
            <div className="rounded-lg border border-green-200 bg-green-50/60 p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-green-800 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-green-600 inline-block" />
                  Bullish
                </span>
                <span className="text-xs font-bold text-green-900">
                  <span className="font-mono tabular-nums">{stats.up}</span>{" "}
                  <span className="text-green-700 font-normal">({upPct}%)</span>
                </span>
              </div>
              <div className="h-1.5 w-full bg-green-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-600 rounded-full transition-all duration-300" style={{ width: `${upPct}%` }} />
              </div>
            </div>

            {/* Bearish */}
            <div className="rounded-lg border border-red-200 bg-red-50/60 p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-red-800 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-600 inline-block" />
                  Bearish
                </span>
                <span className="text-xs font-bold text-red-900">
                  <span className="font-mono tabular-nums">{stats.down}</span>{" "}
                  <span className="text-red-700 font-normal">({downPct}%)</span>
                </span>
              </div>
              <div className="h-1.5 w-full bg-red-100 rounded-full overflow-hidden">
                <div className="h-full bg-red-600 rounded-full transition-all duration-300" style={{ width: `${downPct}%` }} />
              </div>
            </div>

            {/* Neutral */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-400 inline-block" />
                  Unchanged
                </span>
                <span className="text-xs font-bold text-slate-800">
                  <span className="font-mono tabular-nums">{stats.neutral}</span>{" "}
                  <span className="text-slate-600 font-normal">({neutralPct}%)</span>
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-slate-400 rounded-full transition-all duration-300" style={{ width: `${neutralPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Summary Metric Row */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
          <div className="rounded-lg border border-green-200 bg-green-50/60 p-2 text-center">
            <span className="text-[11px] font-semibold text-green-700 block">Bullish</span>
            <span className="text-base font-bold font-mono text-green-900 leading-tight block mt-0.5">
              {stats.up}
            </span>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center">
            <span className="text-[11px] font-semibold text-slate-600 block">Flat</span>
            <span className="text-base font-bold font-mono text-slate-800 leading-tight block mt-0.5">
              {stats.neutral}
            </span>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50/60 p-2 text-center">
            <span className="text-[11px] font-semibold text-red-700 block">Bearish</span>
            <span className="text-base font-bold font-mono text-red-900 leading-tight block mt-0.5">
              {stats.down}
            </span>
          </div>
        </div>
      </div>
    </AnalysisPanel>
  )
}
