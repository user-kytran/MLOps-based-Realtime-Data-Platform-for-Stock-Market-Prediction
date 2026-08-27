"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, PieLabelRenderProps } from "recharts"
import { usePredictions } from "@/hooks/usePredictions"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

const COLORS = {
  up: '#10b981',
  down: '#ef4444', 
  neutral: '#6b7280'
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
    <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-gray-900 text-xl">Today's Market Prediction</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(props: PieLabelRenderProps) => {
                  const percent = Number(props.percent) || 0
                  return `${(percent * 100).toFixed(1)}%`
                }}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                style={{ fontSize: '14px', fontWeight: 'bold' }}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #d1d5db', color: '#374151', fontSize: '13px', fontWeight: 'bold' }}
                labelStyle={{ color: '#374151' }}
                itemStyle={{ color: '#374151' }}
                formatter={(value: number) => {
                  const percentage = ((value / total) * 100).toFixed(1)
                  return [`${value} stocks (${percentage}%)`, '']
                }}
              />
              <Legend 
                verticalAlign="middle"
                align="right"
                layout="vertical"
                iconSize={12}
                wrapperStyle={{ fontSize: '13px', fontWeight: 'bold' }}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-1 gap-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600 font-semibold">Bullish</p>
                  <p className="text-2xl font-bold text-green-600">{stats.up}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-green-600">
                  {total > 0 ? ((stats.up / total) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
              <div className="flex items-center gap-3">
                <TrendingDown className="h-8 w-8 text-red-600" />
                <div>
                  <p className="text-sm text-gray-600 font-semibold">Bearish</p>
                  <p className="text-2xl font-bold text-red-600">{stats.down}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-red-600">
                  {total > 0 ? ((stats.down / total) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Minus className="h-8 w-8 text-yellow-600" />
                <div>
                  <p className="text-sm text-gray-600 font-semibold">Unchanged</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.neutral}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-yellow-600">
                  {total > 0 ? ((stats.neutral / total) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

