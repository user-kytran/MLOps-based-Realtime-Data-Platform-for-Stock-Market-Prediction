"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { usePredictions } from "@/hooks/usePredictions"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { AnalysisPanel, chartColors, MetricTile, tooltipStyle } from "./analysis-ui"

const COLORS = {
  up: chartColors.positive,
  down: chartColors.negative,
  neutral: chartColors.neutral
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

  const chartData = [
    { name: 'Up', value: stats.up, color: COLORS.up },
    { name: 'Down', value: stats.down, color: COLORS.down },
    { name: 'Unchanged', value: stats.neutral, color: COLORS.neutral }
  ].filter(d => d.value > 0)

  const total = stats.up + stats.down + stats.neutral

  return (
    <AnalysisPanel title="Today's Market Prediction" eyebrow={`${total} tracked signals`}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr] xl:grid-cols-1 2xl:grid-cols-[220px_1fr]">
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                innerRadius={54}
                outerRadius={84}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={tooltipStyle}
                labelStyle={{ color: '#0f172a' }}
                itemStyle={{ color: '#334155' }}
                formatter={(value: number) => {
                  const percentage = ((value / total) * 100).toFixed(1)
                  return [`${value} stocks (${percentage}%)`, '']
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:grid-cols-1 xl:grid-cols-3 2xl:grid-cols-1">
            <MetricTile label="Bullish" value={stats.up} tone="positive" icon={<TrendingUp className="h-4 w-4" />} />
            <MetricTile label="Bearish" value={stats.down} tone="negative" icon={<TrendingDown className="h-4 w-4" />} />
            <MetricTile label="Unchanged" value={stats.neutral} tone="amber" icon={<Minus className="h-4 w-4" />} />
          </div>
        </div>
    </AnalysisPanel>
  )
}
