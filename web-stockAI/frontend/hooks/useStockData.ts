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
    setLoading(true)
    setError("")
    if (!isValidStockSymbol(upperSymbol)) {
      setError("Không có dữ liệu cho mã này")
      setLoading(false)
      return
    }
    fetch(`${getApiUrl()}/stocks/stock_info/${upperSymbol}`)
      .then(res => res.json())
      .then((data) => {
        if (!data.error) setStockInfo(data)
        else setError("Không có dữ liệu cho mã này")
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [symbol])

  useEffect(() => {
    fetch(`${getApiUrl()}/stocks/get_reference`)
      .then(res => res.json())
      .then((data) => {
        const item = data.find((d: any) => d.symbol === symbol)
        if (item) setReference(item.close)
      })
      .catch(() => {})
  }, [symbol])

  useEffect(() => {
    cachedFetch(`${getApiUrl()}/stocks/stocks_latest`)
      .then((data) => {
        const stock = data.find((s: any) => s.symbol.split(".")[0] === symbol)
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
      })
      .catch(() => {})
  }, [symbol])

  useEffect(() => {
    fetch(`${getApiUrl()}/stocks/stock_price_by_symbol?symbol=${symbol}`)
      .then(res => res.json())
      .then((data) => {
        if (data && data.length > 0) {
          const orders: MatchedOrder[] = data.map((item: any) => {
            const tsMs = Number(item.timestamp)
            const timestamp = new Date(tsMs)
            const timeStr = `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}:${timestamp.getSeconds().toString().padStart(2, '0')}`
            return { time: timeStr, price: item.price, last_size: item.last_size, change: item.change }
          }).sort((a: MatchedOrder, b: MatchedOrder) => b.time.localeCompare(a.time))
          setMatchedOrders(orders)
        }
      })
      .catch(() => {})
  }, [symbol])

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
      setMatchedOrders(prev => [{ time: timeStr, price: data.price, last_size: data.last_size, change: data.change }, ...prev])
    })
    return () => unsubscribe(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol])

  return { stockInfo, stockRealtime, reference, matchedOrders, loading, error }
}
