"use client"

import { useEffect, useState } from "react"
import type { StockInfo, StockRealtime, MatchedOrder } from "@/types/stock"
import { getApiUrl } from "@/lib/config"
import { isValidStockSymbol } from "@/constants/stocks"
import { useStockWSContext } from "@/lib/stockWSContext"
import { cachedFetch } from "@/lib/apiCache"

export function useStockData(symbol: string) {
  const [stockInfo, setStockInfo] = useState<StockInfo | null>(null)
  const [stockRealtime, setStockRealtime] = useState<StockRealtime | null>(null)
  const [reference, setReference] = useState<number>(0)
  const [matchedOrders, setMatchedOrders] = useState<MatchedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const { subscribe, unsubscribe } = useStockWSContext()

  useEffect(() => {
    const upperSymbol = symbol.toUpperCase()
    if (!isValidStockSymbol(upperSymbol)) {
      setError("No data found for this symbol")
      setLoading(false)
      return
    }

    setLoading(true)
    setError("")

    const apiUrl = getApiUrl()

    // 1. Parallel fetch for stock info, reference price, and latest realtime snapshot (Cached)
    Promise.all([
      cachedFetch(`${apiUrl}/stocks/stock_info/${upperSymbol}`, 10 * 60 * 1000).catch(() => null),
      cachedFetch(`${apiUrl}/stocks/get_reference`, 30 * 60 * 1000).catch(() => []),
      cachedFetch(`${apiUrl}/stocks/stocks_latest`, 2000).catch(() => []),
    ])
      .then(([infoData, refData, latestData]) => {
        if (infoData && !infoData.error) {
          setStockInfo(infoData)
        } else {
          setError("No data found for this symbol")
        }

        if (Array.isArray(refData)) {
          const item = refData.find((d: any) => d.symbol === upperSymbol)
          if (item) setReference(item.close)
        }

        if (Array.isArray(latestData)) {
          const stock = latestData.find((s: any) => s.symbol.split(".")[0] === upperSymbol)
          if (stock) {
            setStockRealtime({
              symbol: stock.symbol.split(".")[0],
              price: stock.price,
              change: stock.change,
              change_percent: stock.change_percent,
              day_volume: stock.day_volume,
              last_size: stock.last_size,
            })
          }
        }
      })
      .finally(() => {
        setLoading(false)
      })

    // 2. Fetch matched orders (Cached & Deduplicated, slice top 100 for high rendering performance)
    cachedFetch(`${apiUrl}/stocks/stock_price_by_symbol?symbol=${encodeURIComponent(upperSymbol)}`, 2000)
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const sliceData = data.slice(-100)
          const orders: MatchedOrder[] = sliceData.map((item: any) => {
            const tsMs = Number(item.timestamp)
            const timestamp = new Date(tsMs)
            const timeStr = `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}:${timestamp.getSeconds().toString().padStart(2, '0')}`
            return { time: timeStr, price: item.price, last_size: item.last_size, change: item.change }
          }).reverse()
          setMatchedOrders(orders)
        }
      })
      .catch(() => {})
  }, [symbol])

  // Real-time WebSocket subscription for live tick updates
  useEffect(() => {
    const id = `useStockData_${symbol}`
    subscribe(id, (data) => {
      if (data.symbol !== symbol) return

      setStockRealtime({
        symbol: data.symbol,
        price: data.price,
        change: data.change,
        change_percent: data.change_percent,
        day_volume: data.day_volume,
        last_size: data.last_size,
      })

      let timeStr = ''
      if (data.timestamp) {
        let tsMs: number | null = null
        if (typeof data.timestamp === 'string') {
          const match = data.timestamp.match(/\d+/)
          if (match) tsMs = Number(match[0])
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
      setMatchedOrders(prev => [{ time: timeStr, price: data.price, last_size: data.last_size, change: data.change }, ...prev.slice(0, 99)])
    })
    return () => unsubscribe(id)
  }, [symbol, subscribe, unsubscribe])

  return { stockInfo, stockRealtime, reference, matchedOrders, loading, error }
}
