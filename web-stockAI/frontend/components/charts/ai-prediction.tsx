"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Brain, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"

// Deterministic AI prediction data to avoid hydration mismatch
const generatePredictionData = (symbol: string) => {
  const data = []
  let price = symbol === "VNM" ? 82500 : 45200
  const now = new Date()
  
  // Use symbol as seed for consistent data
  const seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)

  // Historical data (last 7 days)
  for (let i = 7; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    
    const pseudoRandom = Math.sin(seed + i) * 10000
    const change = (pseudoRandom % 2000) - 1000
    price += change

    data.push({
      date: date.toLocaleDateString("vi-VN"),
      actual: Math.round(price),
      predicted: null,
      type: "historical",
    })
  }

  // Prediction data (next 7 days)
  for (let i = 1; i <= 7; i++) {
    const date = new Date(now)
    date.setDate(date.getDate() + i)
    const trend = 500 // Upward trend
    
    const pseudoRandom = Math.sin(seed + i + 100) * 10000
    const volatility = (pseudoRandom % 1600) - 800
    price += trend + volatility

    data.push({
      date: date.toLocaleDateString("vi-VN"),
      actual: null,
      predicted: Math.round(price),
      type: "prediction",
    })
  }

  return data
}

interface AIPredictionProps {
  symbol: string
}

export function AIPrediction({ symbol }: AIPredictionProps) {
  const predictionData = useMemo(() => generatePredictionData(symbol), [symbol])
  const currentPrice = symbol === "VNM" ? 82500 : 45200
  const predictedPrice = predictionData[predictionData.length - 1]?.predicted || 0
  const priceChange = predictedPrice - currentPrice
  const percentChange = (priceChange / currentPrice) * 100

  const confidence = 78 // Mock confidence score
  const sentiment = percentChange > 0 ? "bullish" : "bearish"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Dự đoán AI cho {symbol}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Prediction Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">Dự đoán 7 ngày</div>
            <div className="text-2xl font-bold font-mono text-foreground">{predictedPrice.toLocaleString("vi-VN")}</div>
            <div className={`text-sm font-mono ${percentChange >= 0 ? "text-success" : "text-destructive"}`}>
              {percentChange >= 0 ? "+" : ""}
              {percentChange.toFixed(2)}%
            </div>
          </div>

          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">Độ tin cậy</div>
            <div className="text-2xl font-bold text-foreground mb-2">{confidence}%</div>
            <Progress value={confidence} className="h-2" />
          </div>

          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">Xu hướng</div>
            <Badge
              variant={sentiment === "bullish" ? "default" : "destructive"}
              className={`${sentiment === "bullish" ? "bg-success hover:bg-success/80" : ""} text-sm`}
            >
              {sentiment === "bullish" ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {sentiment === "bullish" ? "Tăng" : "Giảm"}
            </Badge>
          </div>
        </div>

        {/* Prediction Chart */}
        <div className="h-[300px] w-full mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={predictionData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number, name: string) => [
                  `${value?.toLocaleString("vi-VN")} VND`,
                  name === "actual" ? "Giá thực tế" : "Dự đoán",
                ]}
              />
              <ReferenceLine x={predictionData[7]?.date} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* AI Analysis */}
        <div className="space-y-4">
          <h4 className="font-semibold text-foreground">Phân tích AI</h4>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
              <TrendingUp className="h-5 w-5 text-success mt-0.5" />
              <div>
                <div className="font-medium text-sm">Tín hiệu tích cực</div>
                <div className="text-sm text-muted-foreground">
                  Khối lượng giao dịch tăng mạnh, RSI cho thấy xu hướng tăng bền vững
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
              <div>
                <div className="font-medium text-sm">Lưu ý rủi ro</div>
                <div className="text-sm text-muted-foreground">
                  Thị trường có thể biến động mạnh do ảnh hưởng từ các yếu tố vĩ mô
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
              <Brain className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <div className="font-medium text-sm">Khuyến nghị</div>
                <div className="text-sm text-muted-foreground">
                  Mô hình AI đề xuất chiến lược nắm giữ trung hạn với mức stop-loss tại 78,000 VND
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
