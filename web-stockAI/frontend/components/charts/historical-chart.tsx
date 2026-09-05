"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  Brush,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Maximize2, Minimize2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getApiUrl } from "@/lib/config"
import { cachedFetch } from "@/lib/apiCache"

interface HistoricalChartProps {
  symbol: string
}

interface ApiDailyData {
  trade_date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface TechnicalData extends ApiDailyData {
  date: string
  candleRange: [number, number]
  ma20: number | null
  ma50: number | null
  ma100: number | null
}

type RangeKey = "3M" | "6M" | "1Y" | "3Y" | "5Y"

const RANGE_OPTIONS: Array<{ label: RangeKey; sessions: number }> = [
  { label: "3M", sessions: 63 },
  { label: "6M", sessions: 126 },
  { label: "1Y", sessions: 252 },
  { label: "3Y", sessions: 756 },
  { label: "5Y", sessions: 1260 },
]

const COLORS = {
  up: "#00c83f",
  down: "#ef120b",
  ma20: "#5470c6",
  ma50: "#8bc96f",
  ma100: "#f6bd48",
  grid: "#e5e7eb",
  axis: "#6b7280",
}

function movingAverage(data: ApiDailyData[], index: number, window: number) {
  if (index < window - 1) return null
  let sum = 0
  for (let cursor = index - window + 1; cursor <= index; cursor += 1) {
    sum += Number(data[cursor].close) || 0
  }
  return sum / window
}

function toTechnicalData(rawData: ApiDailyData[]): TechnicalData[] {
  const sorted = rawData
    .filter((item) => item.trade_date && Number.isFinite(Number(item.close)))
    .map((item) => ({
      ...item,
      open: Number(item.open) || 0,
      high: Number(item.high) || 0,
      low: Number(item.low) || 0,
      close: Number(item.close) || 0,
      volume: Number(item.volume) || 0,
    }))
    .sort((a, b) => a.trade_date.localeCompare(b.trade_date))

  return sorted.map((item, index) => ({
    ...item,
    date: item.trade_date,
    candleRange: [item.low, item.high],
    ma20: movingAverage(sorted, index, 20),
    ma50: movingAverage(sorted, index, 50),
    ma100: movingAverage(sorted, index, 100),
  }))
}

function formatPrice(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 })
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-")
  return `${day}-${month}-${year}`
}

function formatAxisDate(value: string) {
  const [, month, day] = value.split("-")
  return `${day}-${month}`
}

function CandlestickShape(props: any) {
  const { x, y, width, height, payload } = props
  if (!payload || !Number.isFinite(x) || !Number.isFinite(y)) return null

  const { open, close, high, low } = payload as TechnicalData
  const positive = close >= open
  const color = positive ? COLORS.up : COLORS.down
  const range = Math.max(high - low, 1)
  const centerX = x + width / 2
  const bodyWidth = Math.max(3, Math.min(width * 0.7, 13))
  const bodyTop = y + ((high - Math.max(open, close)) / range) * height
  const bodyBottom = y + ((high - Math.min(open, close)) / range) * height
  const bodyHeight = Math.max(bodyBottom - bodyTop, 2)

  return (
    <g aria-hidden="true">
      <line x1={centerX} x2={centerX} y1={y} y2={y + height} stroke={color} strokeWidth={1.25} />
      <rect
        x={centerX - bodyWidth / 2}
        y={bodyTop}
        width={bodyWidth}
        height={bodyHeight}
        fill={color}
        rx={0.75}
      />
    </g>
  )
}

function TechnicalTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const item = payload.find((entry: any) => entry?.payload)?.payload as TechnicalData | undefined
  if (!item) return null

  const color = item.close >= item.open ? COLORS.up : COLORS.down
  const rows = [
    ["Open", item.open],
    ["Close", item.close],
    ["Low", item.low],
    ["High", item.high],
  ] as const

  return (
    <div className="w-[250px] rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-xl">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-bold text-gray-900">{formatDate(item.date)}</span>
        <span className="font-mono font-extrabold text-gray-700">{formatPrice(item.volume)} shares</span>
      </div>
      <div className="mb-2 h-px bg-gray-200" />
      <div className="mb-2 flex items-center gap-2 font-bold text-gray-900">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        {item.close >= item.open ? "Up session" : "Down session"}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <span className="text-gray-500">{label}</span>
            <span className="text-right font-mono font-extrabold text-gray-700">{formatPrice(value)}</span>
          </div>
        ))}
      </div>
      <div className="my-2 h-px bg-gray-200" />
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {[
          ["MA20", item.ma20, COLORS.ma20],
          ["MA50", item.ma50, COLORS.ma50],
          ["MA100", item.ma100, COLORS.ma100],
        ].map(([label, value, lineColor]) => (
          <div key={String(label)} className="contents">
            <span className="flex items-center gap-1.5 font-semibold" style={{ color: String(lineColor) }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: String(lineColor) }} />
              {label}
            </span>
            <span className="text-right font-mono font-extrabold text-gray-700">
              {typeof value === "number" ? formatPrice(value) : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LegendItem({ color, label, candle = false }: { color: string; label: string; candle?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-mono font-bold text-gray-600">
      {candle ? (
        <span className="h-4 w-3 rounded-sm" style={{ backgroundColor: color }} />
      ) : (
        <span className="relative block h-3 w-6">
          <span className="absolute left-0 right-0 top-1.5 h-0.5" style={{ backgroundColor: color }} />
          <span className="absolute left-2 top-0.5 h-2.5 w-2.5 rounded-full border-2 bg-white" style={{ borderColor: color }} />
        </span>
      )}
      {label}
    </span>
  )
}

export function HistoricalChart({ symbol }: HistoricalChartProps) {
  const [data, setData] = useState<TechnicalData[]>([])
  const [selectedRange, setSelectedRange] = useState<RangeKey>("3M")
  const [brushRange, setBrushRange] = useState({ startIndex: 0, endIndex: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError("")
    setData([])

    cachedFetch(`${getApiUrl()}/stocks/stock_daily_by_symbol?symbol=${encodeURIComponent(symbol)}`, 10 * 60 * 1000)
      .then((result: ApiDailyData[]) => {
        setData(toTechnicalData(Array.isArray(result) ? result : []))
      })
      .catch((fetchError) => {
        setError("Unable to load chart data.")
      })
      .finally(() => {
        setLoading(false)
      })

    return () => controller.abort()
  }, [symbol])

  useEffect(() => {
    if (!expanded) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [expanded])

  const periodData = useMemo(() => {
    const sessions = RANGE_OPTIONS.find((option) => option.label === selectedRange)?.sessions ?? 63
    return data.slice(-sessions)
  }, [data, selectedRange])

  useEffect(() => {
    setBrushRange({ startIndex: 0, endIndex: Math.max(periodData.length - 1, 0) })
  }, [periodData])

  const visibleData = useMemo(
    () => periodData.slice(brushRange.startIndex, brushRange.endIndex + 1),
    [periodData, brushRange],
  )

  const priceDomain = useMemo<[number, number]>(() => {
    if (!visibleData.length) return [0, 1]
    const lows = visibleData.map((item) => Math.min(item.low, item.ma20 ?? item.low, item.ma50 ?? item.low, item.ma100 ?? item.low))
    const highs = visibleData.map((item) => Math.max(item.high, item.ma20 ?? item.high, item.ma50 ?? item.high, item.ma100 ?? item.high))
    const min = Math.min(...lows)
    const max = Math.max(...highs)
    const padding = Math.max((max - min) * 0.08, max * 0.005)
    return [Math.floor(min - padding), Math.ceil(max + padding)]
  }, [visibleData])

  const latest = visibleData.at(-1)
  const cardClassName = expanded
    ? "fixed inset-2 z-[80] overflow-y-auto border-gray-200 bg-white/95 shadow-2xl backdrop-blur-sm sm:inset-4"
    : "border-gray-200 bg-white/95 shadow-sm backdrop-blur-sm"

  return (
    <Card className={cardClassName}>
      <CardHeader className="gap-3 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className={`font-bold text-slate-900 ${expanded ? "text-lg sm:text-xl" : "text-base sm:text-lg"}`}>
            {symbol} Technical Analysis
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            onClick={() => setExpanded((current) => !current)}
            aria-pressed={expanded}
            className="h-8 border-2 border-transparent bg-[linear-gradient(white,white)_padding-box,linear-gradient(90deg,#c026d3,#2563eb)_border-box] px-3 text-xs font-semibold text-gray-600 hover:text-gray-900"
            style={{
              background:
                "linear-gradient(white, white) padding-box, linear-gradient(90deg, #c026d3, #2563eb) border-box",
            }}
          >
            {expanded ? <Minimize2 /> : <Maximize2 />}
            {expanded ? "Exit expanded view" : "Advanced chart"}
          </Button>
        </div>

        <div className="inline-flex w-fit rounded-lg bg-gray-100 p-0.5" aria-label="Select time range">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => setSelectedRange(option.label)}
              aria-pressed={selectedRange === option.label}
              className={`min-h-8 min-w-11 rounded-md px-3 text-xs font-mono font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                selectedRange === option.label
                  ? "bg-white text-gray-700 shadow-sm"
                  : "text-gray-500 hover:bg-white/60 hover:text-gray-800"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="px-2 pb-5 sm:px-4">
        {loading ? (
          <div className="flex h-[589px] items-center justify-center rounded-lg bg-gray-50 text-sm font-semibold text-gray-500">
            Loading technical data...
          </div>
        ) : error ? (
          <div className="flex h-[589px] items-center justify-center rounded-lg border border-dashed border-red-200 bg-red-50 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : !visibleData.length ? (
          <div className="flex h-[589px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm font-semibold text-gray-500">
            No historical data is available for {symbol}.
          </div>
        ) : (
          <div aria-label={`${symbol} candlestick chart, ${selectedRange} range`} role="img">
            <div className={`relative ${expanded ? "h-[52.25vh] min-h-[399px]" : "h-[409px] sm:h-[475px]"}`}>
              <span className="pointer-events-none absolute left-2 top-1 z-10 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                Price · thousand VND
              </span>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={visibleData}
                  syncId={`technical-${symbol}`}
                  margin={{ top: 14, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid stroke={COLORS.grid} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: COLORS.axis, fontSize: 11, fontWeight: 600, fontFamily: "ui-monospace, monospace" }}
                    tickFormatter={formatAxisDate}
                    tickLine={false}
                    axisLine={{ stroke: "#a8b1c1" }}
                    minTickGap={46}
                    height={34}
                  />
                  <YAxis
                    orientation="right"
                    domain={priceDomain}
                    tick={{ fill: COLORS.axis, fontSize: 11, fontWeight: 600, fontFamily: "ui-monospace, monospace" }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(value >= 100000 ? 0 : 1)}`}
                    tickLine={false}
                    axisLine={false}
                    width={58}
                  />
                  <Tooltip
                    content={<TechnicalTooltip />}
                    cursor={{ stroke: "#94a3b8", strokeDasharray: "5 4" }}
                    isAnimationActive={false}
                  />
                  <Bar dataKey="candleRange" shape={<CandlestickShape />} isAnimationActive={false} />
                  <Line type="linear" dataKey="ma20" stroke={COLORS.ma20} strokeWidth={2.25} dot={false} connectNulls={false} isAnimationActive={false} />
                  <Line type="linear" dataKey="ma50" stroke={COLORS.ma50} strokeWidth={2.25} dot={false} connectNulls={false} isAnimationActive={false} />
                  <Line type="linear" dataKey="ma100" stroke={COLORS.ma100} strokeWidth={2.25} dot={false} connectNulls={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="h-[112px] border-t border-slate-200" aria-label="Trading volume">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={visibleData}
                  syncId={`technical-${symbol}`}
                  margin={{ top: 8, right: 66, bottom: 0, left: 0 }}
                >
                  <XAxis dataKey="date" hide />
                  <YAxis hide domain={[0, "dataMax"]} />
                  <Tooltip content={() => null} cursor={{ stroke: "#94a3b8", strokeDasharray: "5 4" }} />
                  <Bar dataKey="volume" isAnimationActive={false} maxBarSize={18} minPointSize={2}>
                    {visibleData.map((item) => (
                      <Cell key={item.date} fill={item.close >= item.open ? COLORS.up : COLORS.down} />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 h-[68px] rounded-lg border border-blue-100 bg-blue-50/30">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={periodData} margin={{ top: 5, right: 4, bottom: 4, left: 4 }}>
                  <defs>
                    <linearGradient id={`navigator-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#93b4f5" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#93b4f5" stopOpacity={0.08} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" hide />
                  <YAxis hide domain={["dataMin", "dataMax"]} />
                  <Area type="monotone" dataKey="close" stroke="#7da2e8" strokeWidth={1} fill={`url(#navigator-${symbol})`} isAnimationActive={false} />
                  <Brush
                    dataKey="date"
                    height={28}
                    travellerWidth={10}
                    startIndex={brushRange.startIndex}
                    endIndex={brushRange.endIndex}
                    tickFormatter={formatAxisDate}
                    stroke="#9eb3d5"
                    fill="rgba(255,255,255,0.62)"
                    onChange={(range) => {
                      if (typeof range.startIndex === "number" && typeof range.endIndex === "number") {
                        setBrushRange({ startIndex: range.startIndex, endIndex: range.endIndex })
                      }
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              <LegendItem color={latest?.close && latest.close >= latest.open ? COLORS.up : COLORS.down} label={symbol} candle />
              <LegendItem color={COLORS.ma20} label="MA20" />
              <LegendItem color={COLORS.ma50} label="MA50" />
              <LegendItem color={COLORS.ma100} label="MA100" />
            </div>

            <p className="sr-only">
              Latest price {latest ? formatPrice(latest.close) : "unavailable"} VND. The chart includes open, close,
              high, low, volume, and the MA20, MA50, and MA100 moving averages.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
