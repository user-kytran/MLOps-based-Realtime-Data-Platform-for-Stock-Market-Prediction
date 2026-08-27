"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useStocksRealtimeWS } from "@/hooks/useStocksRealtimeWS"
import { AnalysisPanel, axisTick, chartColors, tooltipStyle } from "./analysis-ui"

export function TopVolumeChart() {
  const stocks = useStocksRealtimeWS()

  const topVolume = stocks
    .filter(s => s.match.volume != null && s.match.volume > 0)
    .sort((a, b) => (b.match.volume || 0) - (a.match.volume || 0))
    .slice(0, 10)
    .map(s => ({
      symbol: s.symbol,
      volume: s.match.volume / 1000000,
      fill: s.match.change > 0 ? chartColors.positive : s.match.change < 0 ? chartColors.negative : chartColors.neutral
    }))

  return (
    <AnalysisPanel title="Top 10 Volume" eyebrow="Liquidity leaders">
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={topVolume} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke={chartColors.grid} vertical={false} />
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
              cursor={{ fill:'rgba(15, 118, 110, 0.08)' }}
              contentStyle={tooltipStyle}
              labelStyle={{ color: '#0f172a', fontWeight: 'bold', fontSize: '12px' }}
              itemStyle={{ color: '#334155', fontSize: '11px' }}
              formatter={(value: number) => [`${value.toFixed(2)}M`, 'Volume']}
            />
            <Bar dataKey="volume" radius={[6, 6, 0, 0]} barSize={28} />
          </BarChart>
        </ResponsiveContainer>
    </AnalysisPanel>
  )
}
