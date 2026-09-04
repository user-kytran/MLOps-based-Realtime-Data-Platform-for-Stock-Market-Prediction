"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { useStocksRealtimeWS } from "@/hooks/useStocksRealtimeWS"
import { AnalysisPanel, axisTick, chartColors, tooltipStyle } from "./analysis-ui"

export function TopVolumeChart() {
  const stocks = useStocksRealtimeWS()

  const topVolume = stocks
    .filter(s => s.match?.volume != null && s.match.volume > 0)
    .sort((a, b) => (b.match.volume || 0) - (a.match.volume || 0))
    .slice(0, 10)
    .map(s => ({
      symbol: s.symbol,
      volume: Math.round(((s.match.volume || 0) / 1_000_000) * 100) / 100,
      change: s.match?.change || 0,
      fill: (s.match?.change || 0) > 0 ? "#16a34a" : (s.match?.change || 0) < 0 ? "#dc2626" : "#64748b"
    }))

  return (
    <AnalysisPanel
      title="Top 10 Volume"
      eyebrow="Liquidity leaders"
      action={
        <span className="inline-flex items-center text-xs font-semibold text-cyan-800 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-md">
          Million Shares
        </span>
      }
    >
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={topVolume} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
          <XAxis 
            dataKey="symbol" 
            stroke={chartColors.axis}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke={chartColors.axis}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}M`}
          />
          <Tooltip  
            cursor={{ fill: 'rgba(15, 23, 42, 0.03)' }}
            contentStyle={tooltipStyle}
            formatter={(value: number, name: string, props: any) => [
              `${value.toFixed(2)}M shares (${props.payload.change >= 0 ? "+" : ""}${props.payload.change})`,
              'Volume'
            ]}
          />
          <Bar dataKey="volume" radius={[4, 4, 0, 0]} barSize={22}>
            {topVolume.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </AnalysisPanel>
  )
}
