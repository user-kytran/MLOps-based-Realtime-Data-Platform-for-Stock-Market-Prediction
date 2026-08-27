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
    ...topGainers.map(s => ({ symbol: s.symbol, change: s.match.change_percent, type: 'gain' })),
    ...topLosers.map(s => ({ symbol: s.symbol, change: s.match.change_percent, type: 'loss' }))
  ].sort((a, b) => b.change - a.change)

  return (
    <AnalysisPanel title="Price Change Leaders" eyebrow="Top gainers and losers">
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 18, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="4 4" stroke={chartColors.grid} horizontal={false} />
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
              width={58}
            />
            <Tooltip 
              cursor={{ fill:'rgba(15, 118, 110, 0.08)' }}
              contentStyle={tooltipStyle}
              labelStyle={{ color: '#0f172a', fontWeight: 'bold', fontSize: '12px' }}
              itemStyle={{ color: '#334155', fontSize: '11px' }}
              formatter={(value: number) => [`${value.toFixed(2)}%`, 'Change']}
            />
            <Bar dataKey="change" radius={[0, 6, 6, 0]} barSize={20}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.type === 'gain' ? chartColors.positive : chartColors.negative} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
    </AnalysisPanel>
  )
}
