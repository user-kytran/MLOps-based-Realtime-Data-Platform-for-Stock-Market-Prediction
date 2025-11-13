"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Brain, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { useAccuracy } from "@/hooks/useAccuracy"
import { usePredictionHistory, type PredictionHistoryItem } from "@/hooks/usePredictionHistory"

interface StockPredictionProps {
  symbol: string
}

export function StockPrediction({ symbol }: StockPredictionProps) {
  const accuracyData = useAccuracy()
  const { chartData, nextDayPrediction } = usePredictionHistory(symbol)

  const accuracy = accuracyData[symbol]?.accuracy || 0
  const correctCount = accuracyData[symbol]?.correct || 0
  const totalCount = accuracyData[symbol]?.total || 0

  const getTrendIcon = (trend: "up" | "down" | "neutral" | null) => {
    if (trend === "up") return <TrendingUp className="h-5 w-5" />
    if (trend === "down") return <TrendingDown className="h-5 w-5" />
    return <Minus className="h-5 w-5" />
  }

  const getTrendColor = (trend: "up" | "down" | "neutral" | null) => {
    if (trend === "up") return "text-green-600 bg-green-50"
    if (trend === "down") return "text-red-600 bg-rose-50"
    return "text-gray-600 bg-gray-50"
  }

  const getTrendLabel = (trend: "up" | "down" | "neutral" | null) => {
    if (trend === "up") return "Up"
    if (trend === "down") return "Down"
    return "Neutral"
  }

  return (
    <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600" />
          AI Prediction for {symbol}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className={`text-center p-4 rounded-lg border-2 ${getTrendColor(nextDayPrediction.trend)}`}>
            <div className="text-sm font-semibold mb-2">Predicted Trend</div>
            <div className="flex items-center justify-center gap-2 mb-1">
              {getTrendIcon(nextDayPrediction.trend)}
              <span className="text-2xl font-bold">{getTrendLabel(nextDayPrediction.trend)}</span>
            </div>
            <div className="text-xs text-gray-600">Date {nextDayPrediction.date || "—"}</div>
          </div>

          <div className="text-center p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
            <div className="text-sm text-blue-700 font-semibold mb-2">Accuracy</div>
            <div className="text-2xl font-bold text-blue-900 mb-2">{accuracy.toFixed(1)}%</div>
            <Progress value={accuracy} className="h-2" />
          </div>

          <div className="text-center p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
            <div className="text-sm text-purple-700 font-semibold mb-2">Correct Predictions</div>
            <div className="text-2xl font-bold text-purple-900">{correctCount}/{totalCount}</div>
            <div className="text-xs text-purple-600 mt-1">Total Predictions</div>
          </div>
        </div>

        <div className="h-[350px] w-full mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis 
                tick={{ fontSize: 12 }} 
                tickLine={false} 
                axisLine={false}
                domain={[-1.2, 1.2]}
                ticks={[-1, 0, 1]}
                tickFormatter={(value) => {
                  if (value === 1) return "Up"
                  if (value === -1) return "Down"
                  return "Neutral"
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const data = payload[0].payload as PredictionHistoryItem
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-xl">
                      <div className="text-sm font-semibold mb-2">{data.date}</div>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Actual:</span>
                          <span className={`font-semibold ${data.actual_trend === "up" ? "text-green-600" : data.actual_trend === "down" ? "text-red-600" : "text-gray-600"}`}>
                            {getTrendLabel(data.actual_trend)}
                          </span>
                        </div>
                        {data.is_correct !== null ? (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">Predicted:</span>
                              <span className={`font-semibold ${data.predicted_trend === "up" ? "text-green-600" : data.predicted_trend === "down" ? "text-red-600" : "text-gray-600"}`}>
                                {getTrendLabel(data.predicted_trend)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">Result:</span>
                              <span className={`font-semibold ${data.is_correct ? "text-green-600" : "text-red-600"}`}>
                                {data.is_correct ? "Correct" : "Wrong"}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Predicted:</span>
                            <span className="text-gray-400 text-xs">N/A</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: "20px" }}
                iconType="line"
              />
              <Line
                type="monotone"
                dataKey="predicted_value"
                stroke="#8b5cf6"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Predicted"
                dot={(props: any) => {
                  const { cx, cy, payload } = props
                  if (payload.is_correct === null) {
                    return (
                      <circle cx={cx} cy={cy} r={5} fill="#d1d5db" stroke="#fff" strokeWidth={2} />
                    )
                  }
                  return (
                    <circle cx={cx} cy={cy} r={5} fill="#8b5cf6" stroke="#fff" strokeWidth={2} />
                  )
                }}
                activeDot={{ r: 7 }}
              />
              <Line
                type="monotone"
                dataKey="actual_value"
                stroke="#3b82f6"
                strokeWidth={3}
                name="Actual"
                dot={(props: any) => {
                  const { cx, cy, payload } = props
                  
                  if (payload.is_correct === true) {
                    return (
                      <g>
                        <circle cx={cx} cy={cy} r={12} fill="#10b981" fillOpacity={0.2} />
                        <circle cx={cx} cy={cy} r={8} fill="#10b981" stroke="#fff" strokeWidth={2.5} />
                        <text x={cx} y={cy + 1} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">✓</text>
                      </g>
                    )
                  } else if (payload.is_correct === false) {
                    return (
                      <g>
                        <circle cx={cx} cy={cy} r={12} fill="#ef4444" fillOpacity={0.2} />
                        <circle cx={cx} cy={cy} r={8} fill="#ef4444" stroke="#fff" strokeWidth={2.5} />
                        <text x={cx} y={cy + 1} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">✗</text>
                      </g>
                    )
                  }
                  
                  return (
                    <circle cx={cx} cy={cy} r={6} fill="#3b82f6" stroke="#fff" strokeWidth={2} />
                  )
                }}
                activeDot={{ r: 10 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="text-xs text-gray-600 text-center">
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              <span>Predicted</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>Actual</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="relative">
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-[10px]">✓</div>
              </div>
              <span>Correct</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="relative">
                <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-[10px]">✗</div>
              </div>
              <span>Wrong</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
              <span>No Prediction</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
