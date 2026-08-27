"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { BarChart3 } from "lucide-react"

import { Icons } from "@/components/icons"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { usePredictions } from "@/hooks/usePredictions"
import { getApiUrl } from "@/lib/config"
import { useStockWSContext, type StockWSConnectionStatus } from "@/lib/stockWSContext"
import type { StockInfo } from "@/types/stock"

interface ApiIntradayTick {
  timestamp?: string | number
  price?: number
  day_volume?: number
  last_size?: number
  change?: number
  change_percent?: number
}

interface IntradayPoint {
  time: string
  timestamp: number
  price: number
  volume: number
  change: number
  changePercent: number
  direction: "up" | "down" | "flat"
}

interface StockChartProps {
  symbol: string
  referencePrice?: number
  stockInfo?: StockInfo
}

const COLORS = {
  price: "#2563eb",
  priceFill: "#dbeafe",
  positive: "#00b83f",
  negative: "#ef2424",
  neutral: "#94a3b8",
  reference: "#d97706",
  grid: "#e2e8f0",
  axis: "#64748b",
}

function parseTimestamp(value: string | number | undefined) {
  if (typeof value === "number") return value < 10_000_000_000 ? value * 1000 : value
  if (typeof value !== "string") return Date.now()
  const numeric = Number(value.match(/\d+/)?.[0])
  if (!Number.isFinite(numeric)) return Date.now()
  return numeric < 10_000_000_000 ? numeric * 1000 : numeric
}

function formatMinute(timestamp: number) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp))
}

function getDirection(change: number): IntradayPoint["direction"] {
  if (change > 0) return "up"
  if (change < 0) return "down"
  return "flat"
}

function aggregateTicks(rawTicks: ApiIntradayTick[]) {
  const buckets = new Map<string, IntradayPoint>()
  const sorted = [...rawTicks].sort((a, b) => parseTimestamp(a.timestamp) - parseTimestamp(b.timestamp))

  sorted.forEach((tick) => {
    const price = Number(tick.price)
    if (!Number.isFinite(price) || price <= 0) return
    const timestamp = parseTimestamp(tick.timestamp)
    const time = formatMinute(timestamp)
    const change = Number(tick.change) || 0
    const existing = buckets.get(time)
    const matchedVolume = Math.max(0, Number(tick.last_size) || 0)

    if (existing) {
      existing.timestamp = timestamp
      existing.price = price
      existing.volume += matchedVolume
      existing.change = change
      existing.changePercent = Number(tick.change_percent) || 0
      existing.direction = getDirection(change)
      return
    }

    buckets.set(time, {
      time,
      timestamp,
      price,
      volume: matchedVolume,
      change,
      changePercent: Number(tick.change_percent) || 0,
      direction: getDirection(change),
    })
  })

  return Array.from(buckets.values())
}

function mergeRealtimePoint(points: IntradayPoint[], tick: ApiIntradayTick) {
  const price = Number(tick.price)
  if (!Number.isFinite(price) || price <= 0) return points

  const timestamp = parseTimestamp(tick.timestamp)
  const time = formatMinute(timestamp)
  const change = Number(tick.change) || 0
  const point: IntradayPoint = {
    time,
    timestamp,
    price,
    volume: Math.max(0, Number(tick.last_size) || 0),
    change,
    changePercent: Number(tick.change_percent) || 0,
    direction: getDirection(change),
  }
  const next = [...points]
  const last = next.at(-1)

  if (last?.time === time) {
    next[next.length - 1] = {
      ...point,
      volume: last.volume + point.volume,
    }
  } else {
    next.push(point)
  }

  return next.slice(-360)
}

function formatPrice(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-US", { maximumFractionDigits: 0 })
    : "—"
}

function ConnectionBadge({ status }: { status: StockWSConnectionStatus }) {
  const config = {
    open: { label: "LIVE", className: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
    connecting: { label: "CONNECTING", className: "border-blue-200 bg-blue-50 text-blue-700", dot: "bg-blue-500" },
    reconnecting: { label: "RECONNECTING", className: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500" },
    market_closed: { label: "MARKET CLOSED", className: "border-slate-300 bg-slate-100 text-slate-700", dot: "bg-slate-500" },
    closed: { label: "OFFLINE", className: "border-slate-200 bg-slate-50 text-slate-600", dot: "bg-slate-400" },
  }[status]

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-extrabold tracking-wide ${config.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}

function IntradayTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const point = payload.find((entry: any) => entry?.payload)?.payload as IntradayPoint | undefined
  if (!point) return null
  const positive = point.change >= 0

  return (
    <div className="w-[220px] rounded-lg border border-slate-300 bg-white p-3 text-xs shadow-2xl">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-bold text-slate-950">{point.time}</span>
        <span className="font-mono font-bold text-blue-700">{formatPrice(point.price)} VND</span>
      </div>
      <div className="h-px bg-slate-200" />
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
        <span className="text-slate-500">Change</span>
        <span className={`text-right font-mono font-bold ${positive ? "text-emerald-600" : "text-red-600"}`}>
          {positive ? "+" : ""}{formatPrice(point.change)}
        </span>
        <span className="text-slate-500">Change %</span>
        <span className={`text-right font-mono font-bold ${positive ? "text-emerald-600" : "text-red-600"}`}>
          {positive ? "+" : ""}{point.changePercent.toFixed(2)}%
        </span>
        <span className="text-slate-500">Minute volume</span>
        <span className="text-right font-mono font-bold text-slate-800">{formatPrice(point.volume)}</span>
      </div>
    </div>
  )
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "positive" | "negative" | "neutral" | "accent" }) {
  const valueColor = {
    positive: "text-emerald-600",
    negative: "text-red-600",
    neutral: "text-slate-800",
    accent: "text-blue-700",
  }[tone]

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-center">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`font-mono text-lg font-extrabold ${valueColor}`}>{value}</p>
    </div>
  )
}

export function StockChart({ symbol, referencePrice, stockInfo }: StockChartProps) {
  const [chartData, setChartData] = useState<IntradayPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const predictions = usePredictions()
  const { subscribe, unsubscribe, connectionStatus } = useStockWSContext()
  const trend = predictions[symbol]?.predictionTrend ?? null

  useEffect(() => {
    let mounted = true
    const controller = new AbortController()

    const loadData = async (showLoading = false) => {
      if (showLoading) setLoading(true)
      try {
        const response = await fetch(`${getApiUrl()}/stocks/stock_price_by_symbol?symbol=${encodeURIComponent(symbol)}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const result = await response.json()
        if (mounted) {
          setChartData(aggregateTicks(Array.isArray(result) ? result : []))
          setError("")
        }
      } catch (fetchError: any) {
        if (mounted && fetchError.name !== "AbortError") setError("Unable to load intraday data.")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadData(true)
    const refreshInterval = window.setInterval(() => loadData(false), 60_000)
    return () => {
      mounted = false
      controller.abort()
      window.clearInterval(refreshInterval)
    }
  }, [symbol])

  useEffect(() => {
    const id = `stock-chart-${symbol}`
    subscribe(id, (data) => {
      if (data.symbol !== symbol) return
      setChartData((current) => mergeRealtimePoint(current, data))
    })
    return () => unsubscribe(id)
  }, [symbol, subscribe, unsubscribe])

  const priceDomain = useMemo<[number, number]>(() => {
    const prices = chartData.map((point) => point.price)
    if (referencePrice) prices.push(referencePrice)
    if (!prices.length) return [0, 1]
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const padding = Math.max((max - min) * 0.08, max * 0.003, 50)
    return [Math.floor((min - padding) / 10) * 10, Math.ceil((max + padding) / 10) * 10]
  }, [chartData, referencePrice])

  const stats = useMemo(() => {
    const prices = chartData.map((point) => point.price)
    return {
      open: chartData[0]?.price ?? stockInfo?.open,
      high: prices.length ? Math.max(...prices) : stockInfo?.dayHigh,
      low: prices.length ? Math.min(...prices) : stockInfo?.dayLow,
      last: chartData.at(-1)?.price ?? stockInfo?.currentPrice,
    }
  }, [chartData, stockInfo])

  const trendBadge = (() => {
    if (!trend) return <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Prediction trend: —</span>
    const config = {
      up: { label: "Bullish", className: "border-emerald-200 bg-emerald-50 text-emerald-700", Icon: Icons.TrendingUp },
      down: { label: "Bearish", className: "border-rose-200 bg-rose-50 text-rose-700", Icon: Icons.TrendingDown },
      neutral: { label: "Neutral", className: "border-slate-200 bg-slate-50 text-slate-600", Icon: Icons.Minus },
    }[trend]

    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide ${config.className}`}>
        <config.Icon className="h-3.5 w-3.5" />
        Prediction trend: {config.label}
      </span>
    )
  })()

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="gap-3 pb-2">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="flex items-center gap-2 text-lg font-extrabold text-slate-950 sm:text-xl">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            {symbol} Intraday Trading
          </CardTitle>
          <ConnectionBadge status={connectionStatus} />
          {trendBadge}
        </div>
        <p className="text-xs font-semibold text-slate-500">One-minute price and matched-volume view · Today</p>
      </CardHeader>

      <CardContent className="px-2 pb-4 sm:px-4">
        {loading ? (
          <div className="flex h-[500px] items-center justify-center rounded-lg bg-slate-50 text-sm font-semibold text-slate-500">
            Loading intraday data...
          </div>
        ) : error && !chartData.length ? (
          <div className="flex h-[500px] items-center justify-center rounded-lg border border-dashed border-red-200 bg-red-50 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : !chartData.length ? (
          <div className="flex h-[500px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-500">
            No intraday trades are available for {symbol}.
          </div>
        ) : (
          <div role="img" aria-label={`${symbol} intraday price and minute-volume chart`}>
            <div className="relative h-[340px] sm:h-[430px]">
              <span className="pointer-events-none absolute left-2 top-1 z-10 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Price · thousand VND
              </span>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} syncId={`intraday-${symbol}`} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id={`intraday-fill-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.price} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={COLORS.priceFill} stopOpacity={0.15} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={COLORS.grid} strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: COLORS.axis, fontSize: 12, fontWeight: 600 }}
                    tickLine={false}
                    axisLine={{ stroke: "#a8b1c1" }}
                    minTickGap={52}
                    height={34}
                  />
                  <YAxis
                    orientation="right"
                    domain={priceDomain}
                    tick={{ fill: COLORS.axis, fontSize: 12, fontWeight: 600 }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(1)}`}
                    tickLine={false}
                    axisLine={false}
                    width={58}
                  />
                  <Tooltip content={<IntradayTooltip />} cursor={{ stroke: "#94a3b8", strokeDasharray: "5 4" }} isAnimationActive={false} />
                  {referencePrice ? (
                    <ReferenceLine
                      y={referencePrice}
                      stroke={COLORS.reference}
                      strokeDasharray="6 4"
                      label={{ value: "Reference", position: "insideTopRight", fill: COLORS.reference, fontSize: 10, fontWeight: 700 }}
                    />
                  ) : null}
                  <Area type="linear" dataKey="price" stroke="none" fill={`url(#intraday-fill-${symbol})`} isAnimationActive={false} />
                  <Line
                    type="linear"
                    dataKey="price"
                    stroke={COLORS.price}
                    strokeWidth={2.25}
                    dot={false}
                    activeDot={{ r: 5, fill: COLORS.price, stroke: "#fff", strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="h-[100px] border-t border-slate-200" aria-label="Matched volume by minute">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} syncId={`intraday-${symbol}`} margin={{ top: 8, right: 66, bottom: 0, left: 0 }}>
                  <XAxis dataKey="time" hide />
                  <YAxis hide domain={[0, "dataMax"]} />
                  <Tooltip content={() => null} cursor={{ stroke: "#94a3b8", strokeDasharray: "5 4" }} />
                  <Bar dataKey="volume" isAnimationActive={false} maxBarSize={16} minPointSize={1}>
                    {chartData.map((point) => (
                      <Cell
                        key={`${point.time}-${point.timestamp}`}
                        fill={point.direction === "up" ? COLORS.positive : point.direction === "down" ? COLORS.negative : COLORS.neutral}
                      />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Open" value={formatPrice(stats.open)} />
              <Metric label="High" value={formatPrice(stats.high)} tone="positive" />
              <Metric label="Low" value={formatPrice(stats.low)} tone="negative" />
              <Metric label="Last" value={formatPrice(stats.last)} tone="accent" />
            </div>

            <p className="sr-only">
              Latest price {formatPrice(stats.last)} VND. The chart shows one-minute last prices, reference price, and matched volume.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
