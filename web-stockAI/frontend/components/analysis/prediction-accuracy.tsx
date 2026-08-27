"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, PieLabelRenderProps } from "recharts"
import { useEffect, useState } from "react"
import { API_URL } from "@/lib/api"
import { CheckCircle2, XCircle, Target } from "lucide-react"

interface AccuracyData {
  symbol: string
  accuracy: number
  correct: number
  total: number
}

const COLORS = {
  correct: '#10b981',
  incorrect: '#ef4444',
  chart: ['#0d4d4d', '#116666', '#157a7a', '#1a8f8f', '#1fa3a3', '#24b8b8', '#29cccc', '#47d9d9', '#66e0e0', '#85e6e6', '#a3ecec', '#c2f2f2', '#e0f9f9', '#f0fcfc', '#f7fefe']
}


export function PredictionAccuracy() {
  const [accuracyData, setAccuracyData] = useState<AccuracyData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAccuracy = async () => {
      try {
        const res = await fetch(`${API_URL}/stocks/stock_predictions_accuracy`)
        if (!res.ok) throw new Error('Failed to fetch accuracy data')
        const data: AccuracyData[] = await res.json()
        setAccuracyData(data)
      } catch (error) {
      } finally {
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
      <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-gray-900 text-xl">Prediction Accuracy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px]">
            <p className="text-gray-500">Loading...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-gray-900 text-xl">Prediction Accuracy vs Reality</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
          <div className="lg:col-span-3 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={400}>
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
                  outerRadius={80}
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
                  formatter={(value: number) => {
                    const percentage = ((value / totalStats.total) * 100).toFixed(1)
                    return [`${value} predictions (${percentage}%)`, '']
                  }}
                />
                <Legend 
                  verticalAlign="bottom"
                  align="center"
                  iconSize={12}
                  wrapperStyle={{ fontSize: '13px', fontWeight: 'bold', paddingTop: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="lg:col-span-2 flex flex-col justify-center gap-4">
            <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200 text-center">
              <Target className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <p className="text-xs text-gray-600 font-semibold">Accuracy</p>
              <p className="text-3xl font-bold text-purple-600">{overallAccuracy}%</p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg text-center">
              <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-xs text-gray-600 font-semibold">Correct</p>
              <p className="text-3xl font-bold text-green-600">{totalStats.correct}</p>
            </div>

            <div className="p-4 bg-red-50 rounded-lg text-center">
              <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
              <p className="text-xs text-gray-600 font-semibold">Incorrect</p>
              <p className="text-3xl font-bold text-red-600">{totalStats.total - totalStats.correct}</p>
            </div>
          </div>

          <div className="lg:col-span-5">
            <h3 className="text-lg font-bold text-gray-700 mb-3">Top 10 Most Accurate Predictions</h3>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={top10Accurate} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="symbol" type="category" width={50} style={{ fontSize: '11px', fontWeight: 'bold' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #d1d5db', fontSize: '12px', fontWeight: 'bold' }}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Accuracy']}
                />
                <Bar dataKey="accuracy" fill={COLORS.chart[0]} radius={[0, 4, 4, 0]}>
                  {top10Accurate.map((item, index) => (
                    <Cell key={index} fill={COLORS.chart[index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

