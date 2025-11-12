"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart3 } from "lucide-react"
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { getApiUrl, getWsUrl } from "@/lib/config"
import type { StockInfo } from "@/types/stock"
import { Icons } from "@/components/icons"
import { usePredictions } from "@/hooks/usePredictions"

interface IntradayData {
  time: string
  price: number
  volume: number
  change?: number
  change_percent?: number
}

interface StockChartProps {
  symbol: string
  referencePrice?: number
  stockInfo?: StockInfo
}

const isInTradingHours = () => {
  const now = new Date()
  const day = now.getDay()
  const hour = now.getHours()
  const minute = now.getMinutes()
  
  if (day === 0 || day === 6) return false
  
  const currentTime = hour * 60 + minute
  const startTime = 9 * 60
  const endTime = 15 * 60
  
  return currentTime >= startTime && currentTime < endTime
}

export function StockChart({ symbol, referencePrice, stockInfo }: StockChartProps) {
  const [chartData, setChartData] = useState<IntradayData[]>([])
  const [isRealtime, setIsRealtime] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const predictions = usePredictions()
  const trend = predictions[symbol]?.predictionTrend ?? null

  const trendBadge = (() => {
    if (!trend) {
      return (
        <div className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
          Prediction Trend: —
        </div>
      )
    }

    const map = {
      up: {
        label: "Prediction Trend: Bullish",
        className: "bg-emerald-50 text-emerald-600 border border-emerald-200",
        Icon: Icons.TrendingUp,
      },
      down: {
        label: "Prediction Trend: Bearish",
        className: "bg-rose-50 text-rose-600 border border-rose-200",
        Icon: Icons.TrendingDown,
      },
      neutral: {
        label: "Prediction Trend: Neutral",
        className: "bg-slate-50 text-slate-500 border border-slate-200",
        Icon: Icons.Minus,
      },
    } as const

    const config = map[trend]

    return (
      <div className={`flex items-center gap-3 px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide shadow-sm ${config.className}`}>
        <config.Icon className="h-4 w-4" />
        <span>{config.label}</span>
      </div>
    )
  })()

  const getPriceDomain = () => {
    if (chartData.length === 0) return [0, 100]
    
    const prices = chartData.map(d => d.price)
    const centerPrice = referencePrice || (Math.min(...prices) + Math.max(...prices)) / 2
    const rangeSize = 500
    
    return [
      Math.floor(centerPrice - rangeSize / 2),
      Math.ceil(centerPrice + rangeSize / 2)
    ]
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null

    const data = payload[0]?.payload
    if (!data) return null

    // Safe extraction with fallbacks
    const price = data.price || 0
    const volume = data.volume || 0
    const change = data.change || 0
    const changePercent = data.change_percent || 0
    const isPositive = change >= 0

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-xl">
        <div className="text-blue-600 font-semibold mb-2 text-xs">{label}</div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Price:</span>
            <span className="text-gray-900 font-mono font-bold">{price.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Change:</span>
            <span className={`font-mono font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? '+' : ''}{change.toFixed(0)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Change %:</span>
            <span className={`font-mono font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
            </span>
          </div>
          <div className="border-t border-gray-200 my-1"></div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Volume:</span>
            <span className="text-blue-600 font-mono">{volume.toLocaleString()}</span>
          </div>
        </div>
      </div>
    )
  }


  // Check trading hours periodically
  useEffect(() => {
    const checkTradingHours = () => {
      setIsRealtime(isInTradingHours())
    }
    
    checkTradingHours()
    const interval = setInterval(checkTradingHours, 60000)
    
    return () => clearInterval(interval)
  }, [])

  // Load data on mount
  useEffect(() => {
    const loadData = () => {
      fetch(`${getApiUrl()}/stocks/stock_price_by_symbol?symbol=${symbol}`)
        .then(res => res.json())
        .then((data) => {
          if (data && data.length > 0) {
            const formattedData = data.map((item: any) => {
              const tsMs = Number(item.timestamp)
              const timestamp = new Date(tsMs)
              const timeStr = `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}:${timestamp.getSeconds().toString().padStart(2, '0')}`
              return {
                time: timeStr,
                price: item.price,
                volume: item.day_volume,
                change: item.change,
                change_percent: item.change_percent
              }
            }).sort((a: IntradayData, b: IntradayData) => a.time.localeCompare(b.time))
            
            setChartData(formattedData)
          }
        })
        .catch(err => {})
    }

    loadData()
    
    // Chỉ refresh khi ngoài giờ giao dịch để hiển thị data cuối phiên
    const refreshInterval = setInterval(() => {
      if (!isRealtime) {
        loadData()
      }
    }, 60000)
    
    return () => clearInterval(refreshInterval)
  }, [symbol, isRealtime])

  // WebSocket for real-time updates during trading hours
  useEffect(() => {
    const inTradingHours = isInTradingHours()

    if (inTradingHours) {
      const socket = new WebSocket(`${getWsUrl()}/stocks/ws/stocks_realtime`)
      wsRef.current = socket

      socket.onopen = () => {
        
      }

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.symbol === symbol) {
            let timeStr = ''
            if (data.timestamp) {
              let tsMs: number | null = null
              
              if (typeof data.timestamp === 'string') {
                const match = data.timestamp.match(/\d+/)
                if (match) {
                  tsMs = Number(match[0])
                }
              } else {
                tsMs = Number(data.timestamp)
              }
              
              if (tsMs && !isNaN(tsMs)) {
                const timestamp = new Date(tsMs)
                timeStr = `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}:${timestamp.getSeconds().toString().padStart(2, '0')}`
              }
            }
            
            if (!timeStr) {
              const now = new Date()
              timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
            }
            
            setChartData(prev => {
              const newData = [...prev]
              const lastPoint = newData[newData.length - 1]
              
              if (lastPoint && lastPoint.time === timeStr) {
                newData[newData.length - 1] = {
                  time: timeStr,
                  price: data.price,
                  volume: data.day_volume,
                  change: data.change,
                  change_percent: data.change_percent
                }
              } else {
                newData.push({
                  time: timeStr,
                  price: data.price,
                  volume: data.day_volume,
                  change: data.change,
                  change_percent: data.change_percent
                })
              }
              
              return newData
            })
          }
        } catch (e) {
          
        }
      }

      socket.onerror = (err) => {
        
      }

      return () => {
        socket.close()
      }
    }
  }, [symbol])

  return (
    <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="flex items-center gap-2 text-gray-900 text-2xl font-extrabold">
            <BarChart3 className="h-5 w-5 text-blue-600 text-2xl font-extrabold" />
            Price chart {symbol} - Today
            {isRealtime && (
              <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-full">
                LIVE
              </span>
            )}
          </CardTitle>
          {trendBadge}
        </div>
      </CardHeader>
      <CardContent>

        {/* Chart */}
        <div className="h-[500px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" className="opacity-30" />
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 12, fill: '#6b7280' }} 
                tickLine={false} 
                axisLine={false}
                ticks={['09:00:00', '09:30:00', '10:00:00', '10:30:00', '11:00:00', '11:30:00', '12:00:00', '12:30:00', '13:00:00', '13:30:00', '14:00:00', '14:30:00', '15:00:00']}
                tickFormatter={(value) => value.substring(0, 5)}
              />
              <YAxis
                orientation="right"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                domain={getPriceDomain()}
                tickFormatter={(value) => `${(value / 1000).toFixed(1)}K`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="price"
                stroke="transparent"
                fill="url(#priceGradient)"
                fillOpacity={1}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#3b82f6"
                strokeWidth={1}
                dot={false}
                activeDot={{ r: 6, fill: "#3b82f6", stroke: "#ffffff", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Chart Info */}
        {(chartData.length > 0 || stockInfo) && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-500 text-center">Giá mở cửa</div>
                <div className="font-extrabold text-gray-700 text-center text-2xl">
                  {chartData.length > 0 
                    ? chartData[0]?.price?.toLocaleString("vi-VN") 
                    : stockInfo?.open?.toLocaleString("vi-VN") || "—"}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-center">Giá cao nhất</div>
                <div className="font-extrabold text-green-600 text-center text-2xl">
                  {chartData.length > 0 
                    ? Math.max(...chartData.map((d) => d.price)).toLocaleString("vi-VN")
                    : stockInfo?.dayHigh?.toLocaleString("vi-VN") || "—"}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-center">Giá thấp nhất</div>
                <div className="font-extrabold text-red-600 text-center text-2xl">
                  {chartData.length > 0 
                    ? Math.min(...chartData.map((d) => d.price)).toLocaleString("vi-VN")
                    : stockInfo?.dayLow?.toLocaleString("vi-VN") || "—"}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-center">Giá đóng cửa</div>
                <div className="font-extrabold text-gray-700 text-center text-2xl">
                  {isRealtime 
                    ? "—" 
                    : chartData.length > 0
                      ? chartData[chartData.length - 1]?.price?.toLocaleString("vi-VN")
                      : stockInfo?.currentPrice?.toLocaleString("vi-VN") || "—"}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

