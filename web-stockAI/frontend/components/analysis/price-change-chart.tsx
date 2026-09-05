"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { useStocksRealtimeWS } from "@/hooks/useStocksRealtimeWS"
import { AnalysisPanel, axisTick, chartColors, tooltipStyle } from "./analysis-ui"

export function PriceChangeChart() {
  const stocks = useStocksRealtimeWS()

  const topGainers = stocks
    .filter(s => s.match.change_percent != null && s.match.change_percent > 0)
    .sort((a, b) => b.match.change_percent - a.match.change_percent)
    .slice(0, 5)

  const topLosers = stocks
    .filter(s => s.match.change_percent != null && s.match.change_percent < 0)
    .sort((a, b) => a.match.change_percent - b.match.change_percent)
    .slice(0, 5)

  const chartData = [
    ...topGainers.map(s => ({ symbol: s.symbol, change: Math.round(s.match.change_percent * 100) / 100, type: 'gain' })),
    ...topLosers.map(s => ({ symbol: s.symbol, change: Math.round(s.match.change_percent * 100) / 100, type: 'loss' }))
  ].sort((a, b) => b.change - a.change)

  return (
    <AnalysisPanel
      title="Price Change Leaders"
      eyebrow="Top gainers and losers"
      action={
        <span className="inline-flex items-center text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
          % Delta
        </span>
      }
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 6, right: 28, bottom: 4, left: 6 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} horizontal={false} />
          <XAxis 
            type="number"
            stroke={chartColors.axis}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}%`}
          />
          <YAxis 
            type="category"
            dataKey="symbol" 
            stroke={chartColors.axis}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip 
            cursor={{ fill: 'rgba(15, 23, 42, 0.03)' }}
            contentStyle={tooltipStyle}
            formatter={(value: number) => [`${value >= 0 ? "+" : ""}${value.toFixed(2)}%`, 'Change']}
          />
          <Bar dataKey="change" radius={[0, 4, 4, 0]} barSize={16}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.type === 'gain' ? "#16a34a" : "#dc2626"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </AnalysisPanel>
  )
}
