"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { useAccuracy } from "@/hooks/useAccuracy"
import { usePredictionHistory, type PredictionHistoryItem } from "@/hooks/usePredictionHistory"
import { PredictionStateViewer } from "@/components/charts/PredictionStateViewer"

interface StockPredictionProps {
  symbol: string
}

export function StockPrediction({ symbol }: StockPredictionProps) {
  const accuracyData = useAccuracy()
  const { chartData, nextDayPrediction } = usePredictionHistory(symbol)

  const accuracy = accuracyData[symbol]?.accuracy || 0
  const correctCount = accuracyData[symbol]?.correct || 0
  const totalCount = accuracyData[symbol]?.total || 0



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
    <div className="space-y-4">
      <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-sm font-bold text-gray-900">
            AI Prediction for {symbol}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className={`text-center p-3 rounded-lg border-2 ${getTrendColor(nextDayPrediction.trend)}`}>
              <div className="text-xs font-semibold mb-2">Predicted Trend</div>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="text-2xl font-extrabold">{getTrendLabel(nextDayPrediction.trend)}</span>
              </div>
              <div className="text-xs text-gray-600">Date <span className="font-mono font-semibold">{nextDayPrediction.date || "—"}</span></div>
            </div>

            <div className="text-center p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
              <div className="text-xs text-blue-700 font-semibold mb-2">Accuracy</div>
              <div className="text-xl font-bold font-mono text-blue-900 mb-2">{accuracy.toFixed(1)}%</div>
              <Progress value={accuracy} className="h-2" />
            </div>

            <div className="text-center p-3 bg-purple-50 rounded-lg border-2 border-purple-200">
              <div className="text-xs text-purple-700 font-semibold mb-2">Correct Predictions</div>
              <div className="text-xl font-bold font-mono text-purple-900">{correctCount}/{totalCount}</div>
              <div className="text-xs text-purple-600 mt-1">Total Predictions</div>
            </div>
          </div>

          <div className="h-[200px] w-full mb-2">
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
                  wrapperStyle={{ paddingTop: "6px" }}
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
                        <circle cx={cx} cy={cy} r={5.5} fill="#16a34a" stroke="#ffffff" strokeWidth={2} />
                      )
                    } else if (payload.is_correct === false) {
                      return (
                        <circle cx={cx} cy={cy} r={5.5} fill="#dc2626" stroke="#ffffff" strokeWidth={2} />
                      )
                    }
                    
                    return (
                      <circle cx={cx} cy={cy} r={4.5} fill="#2563eb" stroke="#ffffff" strokeWidth={1.5} />
                    )
                  }}
                  activeDot={{ r: 10 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="text-xs text-slate-600 text-center">
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-purple-500 rounded-full"></div>
                <span>Predicted</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-blue-600 rounded-full"></div>
                <span>Actual</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-green-600 rounded-full"></div>
                <span>Correct</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-red-600 rounded-full"></div>
                <span>Wrong</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-slate-400 rounded-full"></div>
                <span>No Prediction</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <PredictionStateViewer
        symbol={symbol}
        stateText={nextDayPrediction.state}
        decision={nextDayPrediction.decision}
        confidenceScore={nextDayPrediction.confidence_score}
        predictionDate={nextDayPrediction.date}
      />
    </div>
  )
}
