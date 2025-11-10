"use client"

import { StockWidget } from "./stock-widget"
import { useStocksRealtimeWS } from "@/hooks/useStocksRealtimeWS"

export function StockWidgetsSection() {
  const stocks = useStocksRealtimeWS()
  
  // Lấy 5 mã có giá cao nhất, không trùng lặp
  const topStocks = stocks
    .filter(stock => stock.match.price > 0) // Chỉ lấy mã có giá > 0
    .sort((a, b) => b.match.price - a.match.price) // Sắp xếp theo giá giảm dần
    .slice(0, 5) // Lấy 5 mã đầu tiên

  return (
    <section className="w-full py-4">
      <div className="w-full px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {topStocks.map((stock) => (
            <StockWidget
              key={stock.symbol}
              symbol={stock.symbol}
              companyName={stock.symbol}
              price={stock.match.price}
              change={stock.lastChange ?? stock.match.change}
              changePercent={stock.lastChangePercent ?? stock.match.change_percent}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
