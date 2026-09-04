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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[200px_1fr] items-center">
        {/* Donut Chart with center summary */}
        <div className="relative h-[200px] w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
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
            <span className="text-2xl font-extrabold text-slate-800 leading-tight">{total}</span>
            <span className="text-[11px] font-medium text-slate-500">Symbols</span>
          </div>
        </div>

        {/* Detailed Indicator Rows */}
        <div className="space-y-2">
          {/* Bullish */}
          <div className="rounded-lg border border-green-200 bg-green-50/60 p-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-green-800 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green-600 inline-block" />
                Bullish
              </span>
              <span className="text-xs font-bold text-green-900">{stats.up} ({upPct}%)</span>
            </div>
            <div className="h-1.5 w-full bg-green-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-600 rounded-full" style={{ width: `${upPct}%` }} />
            </div>
          </div>

          {/* Bearish */}
          <div className="rounded-lg border border-red-200 bg-red-50/60 p-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-red-800 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-600 inline-block" />
                Bearish
              </span>
              <span className="text-xs font-bold text-red-900">{stats.down} ({downPct}%)</span>
            </div>
            <div className="h-1.5 w-full bg-red-100 rounded-full overflow-hidden">
              <div className="h-full bg-red-600 rounded-full" style={{ width: `${downPct}%` }} />
            </div>
          </div>

          {/* Neutral */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-400 inline-block" />
                Unchanged
              </span>
              <span className="text-xs font-bold text-slate-800">{stats.neutral} ({neutralPct}%)</span>
            </div>
            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-slate-400 rounded-full" style={{ width: `${neutralPct}%` }} />
            </div>
          </div>
        </div>
      </div>
    </AnalysisPanel>
  )
}
