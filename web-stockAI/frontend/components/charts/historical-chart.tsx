"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, LineChart, Table2 } from "lucide-react"
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area } from "recharts"
import { getApiUrl } from "@/lib/config"

interface HistoricalData {
  date: string
  time?: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface HistoricalChartProps {
  symbol: string
}

const timeFrames = [
  { label: "1D", value: "1d", days: 1 },
  { label: "1M", value: "1m", days: 30 },
  { label: "3M", value: "3m", days: 90 },
  { label: "6M", value: "6m", days: 180 },
  { label: "1Y", value: "1y", days: 365 },
]

export function HistoricalChart({ symbol }: HistoricalChartProps) {
  const [chartData, setChartData] = useState<HistoricalData[]>([])
  const [selectedTimeFrame, setSelectedTimeFrame] = useState("1m")
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart")
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  useEffect(() => {
    setLoading(true)
    
    const fetchData = async () => {
      try {
        let url = ''
        const currentTimeFrame = timeFrames.find((tf) => tf.value === selectedTimeFrame) || timeFrames[1]
        const isSameDay = fromDate && toDate && fromDate === toDate
        
        // Nếu chọn cùng 1 ngày hoặc timeFrame là 1d, lấy dữ liệu intraday
        if (selectedTimeFrame === '1d' || isSameDay) {
          url = `${getApiUrl()}/stocks/stock_price_by_symbol?symbol=${symbol}`
        } else {
          if (fromDate && toDate) {
            url = `${getApiUrl()}/stocks/stock_daily_by_symbol?symbol=${symbol}&from_date=${fromDate}&to_date=${toDate}`
          } else {
            url = `${getApiUrl()}/stocks/stock_daily_by_symbol?symbol=${symbol}`
          }
        }
        
        const response = await fetch(url)
        const data = await response.json()
        
        if (data && data.length > 0) {
          let formattedData: HistoricalData[] = []
          
          // Format dữ liệu intraday (cho 1d hoặc khi chọn cùng 1 ngày)
          if (selectedTimeFrame === '1d' || isSameDay) {
            formattedData = data.map((item: any) => {
              const tsMs = Number(item.timestamp)
              const timestamp = new Date(tsMs)
              const dateStr = `${timestamp.getDate()}/${timestamp.getMonth() + 1}`
              const timeStr = `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}`
              
              return {
                date: isSameDay ? `${dateStr} ${timeStr}` : timeStr,
                time: timeStr,
                open: item.open || item.price || 0,
                high: item.high || item.price || 0,
                low: item.low || item.price || 0,
                close: item.close || item.price || 0,
                volume: item.volume || item.day_volume || 0
              }
            }).sort((a: HistoricalData, b: HistoricalData) => {
              if (a.time && b.time) return a.time.localeCompare(b.time)
              return 0
            })
          } else {
            formattedData = data
              .map((item: any) => ({
                date: item.trade_date,
                open: item.open || 0,
                high: item.high || 0,
                low: item.low || 0,
                close: item.close || 0,
                volume: item.volume || 0
              }))
              .sort((a: HistoricalData, b: HistoricalData) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .slice(-currentTimeFrame.days)
          }
          
          setChartData(formattedData)
        }
        setLoading(false)
      } catch (err) {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [symbol, selectedTimeFrame, fromDate, toDate])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null

    const data = payload[0].payload
    const change = data.close - data.open
    const changePercent = data.open > 0 ? (change / data.open) * 100 : 0
    const isPositive = change >= 0

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-xl">
        <div className="text-blue-600 font-semibold mb-2 text-xs">{label}</div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Open:</span>
            <span className="text-gray-700 font-mono font-semibold">{data.open.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">High:</span>
            <span className="text-green-600 font-mono font-semibold">{data.high.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Low:</span>
            <span className="text-red-600 font-mono font-semibold">{data.low.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Close:</span>
            <span className="text-gray-900 font-mono font-bold">{data.close.toLocaleString()}</span>
          </div>
          <div className="border-t border-gray-200 my-1"></div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Volume:</span>
            <span className="text-blue-600 font-mono">{data.volume.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Change:</span>
            <span className={`font-mono font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? '+' : ''}{change.toFixed(0)} ({changePercent.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2 text-gray-900 text-2xl font-extrabold">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Historical chart {symbol}
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <Button
              variant={viewMode === "chart" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("chart")}
              className="text-xs"
            >
              <LineChart className="h-3 w-3 mr-1" />
              Chart
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="text-xs"
            >
              <Table2 className="h-3 w-3 mr-1" />
              Table
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Time Frames */}
        <div className="flex items-center gap-2 mb-4">
          {timeFrames.map((timeFrame) => (
            <Button
              key={timeFrame.value}
              variant={selectedTimeFrame === timeFrame.value ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectedTimeFrame(timeFrame.value)
                setFromDate("")
                setToDate("")
              }}
              className="text-xs"
            >
              {timeFrame.label}
            </Button>
          ))}
        </div>

        {/* Date Range Filter */}
        {selectedTimeFrame !== '1d' && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-sm font-medium text-gray-700">Chọn khoảng thời gian:</label>
              <div className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Từ:</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    max={toDate}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <span className="text-gray-400">→</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Đến:</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    min={fromDate}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                {(fromDate || toDate) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFromDate("")
                      setToDate("")
                    }}
                    className="text-xs"
                  >
                    Xóa
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="h-[500px] flex items-center justify-center">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[500px] flex items-center justify-center">
            <div className="text-gray-500">No data available</div>
          </div>
        ) : viewMode === "table" ? (
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="text-left p-3 text-gray-600 font-semibold">Date/Time</th>
                  <th className="text-right p-3 text-gray-600 font-semibold">Open</th>
                  <th className="text-right p-3 text-gray-600 font-semibold">High</th>
                  <th className="text-right p-3 text-gray-600 font-semibold">Low</th>
                  <th className="text-right p-3 text-gray-600 font-semibold">Close</th>
                  <th className="text-right p-3 text-gray-600 font-semibold">Volume</th>
                  <th className="text-right p-3 text-gray-600 font-semibold">Change</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((row, index) => {
                  const change = row.close - row.open
                  const changePercent = row.open > 0 ? (change / row.open) * 100 : 0
                  const isPositive = change >= 0
                  
                  return (
                    <tr 
                      key={index} 
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="p-3 text-gray-500 font-mono text-xs">{row.date}</td>
                      <td className="p-3 text-right text-gray-700 font-mono">{row.open.toLocaleString()}</td>
                      <td className="p-3 text-right text-purple-600 font-mono">{row.high.toLocaleString()}</td>
                      <td className="p-3 text-right text-amber-600 font-mono">{row.low.toLocaleString()}</td>
                      <td className="p-3 text-right text-gray-700 font-mono font-bold">{row.close.toLocaleString()}</td>
                      <td className="p-3 text-right text-blue-600 font-mono">{row.volume.toLocaleString()}</td>
                      <td className={`p-3 text-right font-mono font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {isPositive ? '+' : ''}{change.toFixed(0)} ({changePercent.toFixed(2)}%)
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-[500px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <defs>
                  <linearGradient id="volumeGradientHist" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" className="opacity-30" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 11, fill: '#6b7280' }} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => {
                    const isSameDay = fromDate && toDate && fromDate === toDate
                    
                    if (selectedTimeFrame === '1d') {
                      return value.substring(0, 5)
                    } else if (isSameDay && value.includes(' ')) {
                      // Format: "1/10 09:00" -> chỉ hiển thị phần time
                      return value.split(' ')[1] || value
                    }
                    const date = new Date(value)
                    return `${date.getDate()}/${date.getMonth() + 1}`
                  }}
                />
                <YAxis
                  yAxisId="price"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                />
                <YAxis
                  yAxisId="volume"
                  orientation="left"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  yAxisId="volume"
                  dataKey="volume"
                  fill="url(#volumeGradientHist)"
                  radius={[4, 4, 0, 0]}
                  opacity={0.6}
                  isAnimationActive={false}
                />
                <Area
                  yAxisId="price"
                  type="monotone"
                  dataKey="close"
                  stroke="#3b82f6"
                  fill="url(#areaGradient)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {chartData.length > 0 && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-500 text-center">Period</div>
                <div className="font-extrabold text-[20px] text-gray-700 text-center">
                  {timeFrames.find(tf => tf.value === selectedTimeFrame)?.label}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-center">Highest</div>
                <div className="font-extrabold text-[20px] text-purple-600 text-center">
                  {Math.max(...chartData.map((d) => d.high)).toLocaleString("vi-VN")}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-center">Lowest</div>
                <div className="font-extrabold text-[20px] text-amber-600 text-center">
                  {Math.min(...chartData.map((d) => d.low)).toLocaleString("vi-VN")}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-center">Avg Volume</div>
                <div className="font-extrabold text-[20px] text-gray-700 text-center">
                  {(chartData.reduce((sum, d) => sum + d.volume, 0) / chartData.length).toLocaleString("vi-VN", { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

