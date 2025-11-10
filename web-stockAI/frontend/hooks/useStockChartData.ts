import { useEffect, useState } from "react"
import { getApiUrl } from "@/lib/config"

interface ChartDataPoint {
  price: number
  timestamp: number
}

export function useStockChartData(symbol: string) {
  const [chartData, setChartData] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [hasData, setHasData] = useState(false)

  useEffect(() => {
    setLoading(true)
    
    const fetchChartData = async () => {
      try {
        const response = await fetch(`${getApiUrl()}/stocks/stock_price_by_symbol?symbol=${symbol}`)
        const data = await response.json()
        
        if (data && data.length > 0) {
          const sortedData = data
            .map((item: any) => ({
              price: item.price || 0,
              timestamp: Number(item.timestamp)
            }))
            .sort((a: ChartDataPoint, b: ChartDataPoint) => a.timestamp - b.timestamp)
          
          const prices = sortedData
            .slice(-50)
            .map((item: any) => item.price)
          setChartData(prices)
          setHasData(true)
        } else {
          setChartData([])
          setHasData(false)
        }
      } catch (error) {
        setChartData([])
        setHasData(false)
      } finally {
        setLoading(false)
      }
    }

    fetchChartData()
  }, [symbol])

  return { chartData, loading, hasData }
}
