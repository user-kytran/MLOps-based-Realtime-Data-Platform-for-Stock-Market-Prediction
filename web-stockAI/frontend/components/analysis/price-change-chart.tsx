"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { useStocksRealtimeWS } from "@/hooks/useStocksRealtimeWS"

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
    <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-gray-900 text-xl">Price Change</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
            <XAxis 
              type="number"
              stroke="#6b7280"
              tick={{ fill: '#6b7280' }}
              label={{ value: '%', position: 'insideRight', fill: '#6b7280' }}
            />
            <YAxis 
              type="category"
              dataKey="symbol" 
              stroke="#6b7280"
              tick={{ fill: '#6b7280' }}
            />
            <Tooltip 
              cursor={{ fill:'rgba(6, 182, 212, 0.1)' }}
              contentStyle={{ 
                backgroundColor: '#ffffff', 
                border: '1px solid #d1d5db', 
                color: '#374151',
                fontSize: '12px',
                padding: '8px',
                borderRadius: '6px'
              }}
              labelStyle={{ color: '#374151', fontWeight: 'bold', fontSize: '12px' }}
              itemStyle={{ color: '#374151', fontSize: '11px' }}
              formatter={(value: number) => [`${value.toFixed(2)}%`, 'Change']}
            />
            <Bar dataKey="change" radius={[0, 8, 8, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.type === 'gain' ? '#22c55e' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

