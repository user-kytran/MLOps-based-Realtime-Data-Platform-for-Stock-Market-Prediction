"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useStocksRealtimeWS } from "@/hooks/useStocksRealtimeWS"

export function TopVolumeChart() {
  const stocks = useStocksRealtimeWS()

  const topVolume = stocks
    .filter(s => s.match.volume != null && s.match.volume > 0)
    .sort((a, b) => (b.match.volume || 0) - (a.match.volume || 0))
    .slice(0, 10)
    .map(s => ({
      symbol: s.symbol,
      volume: s.match.volume / 1000000,
      fill: s.match.change > 0 ? '#22c55e' : s.match.change < 0 ? '#ef4444' : '#6b7280'
    }))

  return (
    <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-gray-900 text-xl">Top 10 Volume</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={topVolume}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
            <XAxis 
              dataKey="symbol" 
              stroke="#6b7280"
              tick={{ fill: '#6b7280' }}
            />
            <YAxis 
              stroke="#6b7280"
              tick={{ fill: '#6b7280' }}
              label={{ value: 'Million Shares', angle: -90, position: 'insideLeft', fill: '#6b7280' }}
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
              formatter={(value: number) => [`${value.toFixed(2)}M`, 'Volume']}
            />
            <Bar dataKey="volume" radius={[8, 8, 8, 8]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

