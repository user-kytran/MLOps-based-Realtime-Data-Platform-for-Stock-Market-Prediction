"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"
import { useEffect, useState } from "react"
import { API_URL } from "@/lib/api"
import { cachedFetch } from "@/lib/apiCache"
import { CheckCircle2, XCircle, Target } from "lucide-react"
import { AnalysisPanel, axisTick, chartColors, MetricTile, sectorPalette, tooltipStyle } from "./analysis-ui"

interface AccuracyData {
  symbol: string
  accuracy: number
  correct: number
  total: number
}

const COLORS = {
  correct: chartColors.positive,
  incorrect: chartColors.negative,
  chart: sectorPalette
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

  const chartData = [
    { name: 'Correct', value: totalStats.correct, color: COLORS.correct },
    { name: 'Incorrect', value: totalStats.total - totalStats.correct, color: COLORS.incorrect }
  ].filter(d => d.value > 0)

  const top10Accurate = [...accuracyData]
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 10)
    .map(item => ({
      symbol: item.symbol,
      accuracy: item.accuracy
    }))

  if (loading) {
    return (
      <AnalysisPanel title="Prediction Accuracy" eyebrow="Model quality">
          <div className="flex items-center justify-center h-[400px]">
            <p className="text-sm font-semibold text-slate-500">Loading...</p>
          </div>
      </AnalysisPanel>
    )
  }

  return (
    <AnalysisPanel title="Prediction Accuracy vs Reality" eyebrow={`${totalStats.total} resolved calls`}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="flex flex-col items-center justify-center gap-3 lg:col-span-3">
            <div className="aspect-square w-full max-w-[240px] min-w-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius="56%"
                    outerRadius="78%"
                    fill="#8884d8"
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <text
                    x="50%"
                    y="47%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-slate-500 text-[11px] font-bold uppercase tracking-[0.08em]"
                  >
                    Accuracy
                  </text>
                  <text
                    x="50%"
                    y="58%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-teal-700 text-2xl font-bold"
                  >
                    {overallAccuracy}%
                  </text>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => {
                      const percentage = ((value / totalStats.total) * 100).toFixed(1)
                      return [`${value} predictions (${percentage}%)`, '']
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 text-xs font-bold">
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
                Correct
              </span>
              <span className="inline-flex items-center gap-1.5 text-red-700">
                <span className="h-2.5 w-2.5 rounded-sm bg-red-600" />
                Incorrect
              </span>
            </div>
          </div>

          <div className="grid content-center gap-2 sm:grid-cols-3 lg:col-span-3 lg:grid-cols-1">
            <MetricTile label="Accuracy" value={`${overallAccuracy}%`} tone="accent" icon={<Target className="h-4 w-4" />} />
            <MetricTile label="Correct" value={totalStats.correct} tone="positive" icon={<CheckCircle2 className="h-4 w-4" />} />
            <MetricTile label="Incorrect" value={totalStats.total - totalStats.correct} tone="negative" icon={<XCircle className="h-4 w-4" />} />
          </div>

          <div className="lg:col-span-6">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
              Top 10 Most Accurate Predictions
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={top10Accurate} layout="vertical" margin={{ top: 4, right: 14, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="4 4" stroke={chartColors.grid} horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}%`}
                />
                <YAxis dataKey="symbol" type="category" width={52} tick={axisTick} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Accuracy']}
                />
                <Bar dataKey="accuracy" fill={COLORS.chart[0]} radius={[0, 6, 6, 0]} barSize={20}>
                  {top10Accurate.map((item, index) => (
                    <Cell key={index} fill={COLORS.chart[index % COLORS.chart.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
    </AnalysisPanel>
  )
}
