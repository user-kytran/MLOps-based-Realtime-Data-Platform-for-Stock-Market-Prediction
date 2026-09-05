"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"
import { useEffect, useState } from "react"
import { API_URL } from "@/lib/api"
import { cachedFetch } from "@/lib/apiCache"
import { AnalysisPanel, axisTick, chartColors, tooltipStyle } from "./analysis-ui"

interface AccuracyData {
  symbol: string
  accuracy: number
  correct: number
  total: number
}

const COLORS = {
  correct: chartColors.positive,
  incorrect: chartColors.negative,
}

export function PredictionAccuracy() {
  const [accuracyData, setAccuracyData] = useState<AccuracyData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAccuracy = async () => {
      try {
        const data: AccuracyData[] = await cachedFetch(`${API_URL}/stocks/stock_predictions_accuracy`, 10 * 60 * 1000)
        setAccuracyData(data)
      } catch {} finally {
        setLoading(false)
      }
    }

    fetchAccuracy()
    const interval = setInterval(fetchAccuracy, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const totalStats = accuracyData.reduce(
    (acc, item) => ({
      correct: acc.correct + item.correct,
      total: acc.total + item.total
    }),
    { correct: 0, total: 0 }
  )

  const overallAccuracy = totalStats.total > 0 
    ? ((totalStats.correct / totalStats.total) * 100).toFixed(1)
    : '0'

  const chartData = totalStats.total > 0
    ? [
        { name: 'Correct', value: totalStats.correct, color: COLORS.correct },
        { name: 'Incorrect', value: totalStats.total - totalStats.correct, color: COLORS.incorrect }
      ].filter(d => d.value > 0)
    : [
        { name: 'Pending', value: 1, color: '#cbd5e1' }
      ]

  const top10Accurate = [...accuracyData]
    .filter(item => item.total > 0)
    .sort((a, b) => b.accuracy - a.accuracy || b.total - a.total)
    .slice(0, 10)
    .map(item => ({
      symbol: item.symbol,
      accuracy: Math.round(item.accuracy * 10) / 10,
      correct: item.correct,
      total: item.total
    }))

  if (loading) {
    return (
      <AnalysisPanel title="Prediction Accuracy vs Reality" eyebrow="Model audit">
        <div className="flex items-center justify-center h-[280px] text-xs font-semibold text-slate-400">
          Loading accuracy metrics...
        </div>
      </AnalysisPanel>
    )
  }

  return (
    <AnalysisPanel
      title="Prediction Accuracy vs Reality"
      eyebrow={totalStats.total > 0 ? `${totalStats.total} resolved calls` : "Pending session resolutions"}
      action={
        <span className="inline-flex items-center text-xs font-semibold text-cyan-800 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-md">
          Backtest Audit
        </span>
      }
    >
      <div className="flex flex-col justify-between h-full gap-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-center">
          {/* Left: Accuracy Donut Gauge */}
          <div className="flex flex-col items-center justify-center lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-100 pb-4 lg:pb-0 lg:pr-4">
            <div className="relative h-[180px] w-[180px]">
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
                    formatter={(value: number, name: string) => [
                      `${value} predictions (${((value / totalStats.total) * 100).toFixed(1)}%)`,
                      name
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-extrabold font-mono text-slate-800 leading-tight">{overallAccuracy}%</span>
                <span className="text-[11px] font-semibold text-slate-500">Accuracy</span>
              </div>
            </div>
          </div>

          {/* Right: Top 10 Most Accurate Stocks */}
          <div className="lg:col-span-8">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-xs font-bold text-slate-800">
                Top 10 Most Accurate Predictions
              </h4>
              <span className="text-[11px] text-slate-400">Accuracy %</span>
            </div>

            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={top10Accurate} layout="vertical" margin={{ top: 2, right: 28, bottom: 2, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}%`}
                />
                <YAxis
                  dataKey="symbol"
                  type="category"
                  width={42}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string, props: any) => [
                    `${value.toFixed(1)}% (${props.payload.correct}/${props.payload.total} sessions)`,
                    'Hit Rate'
                  ]}
                />
                <Bar dataKey="accuracy" radius={[0, 4, 4, 0]} barSize={12}>
                  {top10Accurate.map((item, index) => (
                    <Cell
                      key={index}
                      fill={item.accuracy >= 70 ? "#16a34a" : item.accuracy >= 50 ? "#0891b2" : "#64748b"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom Metric Row (Matching PredictionSummary) */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
          <div className="rounded-lg border border-green-200 bg-green-50/60 p-2 text-center">
            <span className="text-[11px] font-semibold text-green-700 block">Correct Matches</span>
            <span className="text-base font-bold font-mono text-green-900 leading-tight block mt-0.5">
              {totalStats.correct}
            </span>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50/60 p-2 text-center">
            <span className="text-[11px] font-semibold text-red-700 block">Incorrect Matches</span>
            <span className="text-base font-bold font-mono text-red-900 leading-tight block mt-0.5">
              {totalStats.total - totalStats.correct}
            </span>
          </div>
        </div>
      </div>
    </AnalysisPanel>
  )
}
