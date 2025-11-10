import { useEffect, useState, useRef } from "react"
import type { StockInfo, StockRealtime, MatchedOrder } from "@/types/stock"
import { getApiUrl, getWsUrl } from "@/lib/config"
import { isValidStockSymbol } from "@/constants/stocks"

export function useStockData(symbol: string) {
  const [stockInfo, setStockInfo] = useState<StockInfo | null>(null)
  const [stockRealtime, setStockRealtime] = useState<StockRealtime | null>(null)
  const [reference, setReference] = useState<number>(0)
  const [matchedOrders, setMatchedOrders] = useState<MatchedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

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
        if (!data.error) {
          setStockInfo(data)
        } else {
          setError("Không có dữ liệu cho mã này")
        }
        setLoading(false)
      })
      .catch(err => {
        setLoading(false)
      })
  }, [symbol])

  // Fetch reference price
  useEffect(() => {
    fetch(`${getApiUrl()}/stocks/get_reference`)
      .then(res => res.json())
      .then((data) => {
        const item = data.find((d: any) => d.symbol === symbol)
        if (item) {
          setReference(item.close)
        }
      })
      .catch(err => console.error("Failed to load reference:", err))
  }, [symbol])

  // Fetch latest price từ API
  useEffect(() => {
    fetch(`${getApiUrl()}/stocks/stocks_latest`)
      .then(res => res.json())
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
      .catch(err => console.error("Failed to load stock data:", err))
  }, [symbol])

  // Fetch lịch sử matched orders trong ngày
  useEffect(() => {
    setHistoryLoaded(false)
    fetch(`${getApiUrl()}/stocks/stock_price_by_symbol?symbol=${symbol}`)
      .then(res => res.json())
      .then((data) => {
        if (data && data.length > 0) {
          const orders: MatchedOrder[] = data.map((item: any) => {
            const tsMs = Number(item.timestamp)
            const timestamp = new Date(tsMs)
            const timeStr = `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}:${timestamp.getSeconds().toString().padStart(2, '0')}`
            return {
              time: timeStr,
              price: item.price,
              last_size: item.last_size,
              change: item.change,
            }
          }).sort((a: MatchedOrder, b: MatchedOrder) => b.time.localeCompare(a.time))
          
          setMatchedOrders(orders)
        }
        setHistoryLoaded(true)
      })
      .catch(err => {
        console.error("Failed to load matched orders:", err)
        setHistoryLoaded(true)
      })
  }, [symbol])

  // WebSocket để nhận realtime updates - chỉ connect sau khi load history
  useEffect(() => {
    if (!historyLoaded) return

    const socket = new WebSocket(`${getWsUrl()}/stocks/ws/stocks_realtime`)
    wsRef.current = socket

    socket.onopen = () => {
      console.log("Connected to stock detail WS")
    }

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.symbol === symbol) {
          setStockRealtime({
            symbol: data.symbol,
            price: data.price,
            change: data.change,
            change_percent: data.change_percent,
            day_volume: data.day_volume,
            last_size: data.last_size,
          })
          
          // Thêm vào danh sách matched orders - dùng timestamp từ API
          let timeStr = ''
          if (data.timestamp) {
            let tsMs: number | null = null
            
            // Parse timestamp - có thể là string hoặc number
            if (typeof data.timestamp === 'string') {
              // Format: 'Timestamp(CqlTimestamp(1760413730000))'
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
          
          // Fallback to current time if timestamp not available
          if (!timeStr) {
            const now = new Date()
            timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
          }
          
          const newOrder: MatchedOrder = {
            time: timeStr,
            price: data.price,
            last_size: data.last_size,
            change: data.change,
          }
          
          setMatchedOrders(prev => [newOrder, ...prev])
        }
      } catch (e) {
        console.error("WS parse error:", e)
      }
    }

    socket.onerror = (err) => {
      console.error("WS error:", err)
    }

    return () => {
      socket.close()
    }
  }, [symbol, historyLoaded])

  return {
    stockInfo,
    stockRealtime,
    reference,
    matchedOrders,
    loading,
    error,
  }
}

