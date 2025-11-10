import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { StockInfo, StockRealtime } from "@/types/stock"

interface StockInfoSidebarProps {
  stockInfo: StockInfo
  stockRealtime: StockRealtime
  reference: number
}

export function StockInfoSidebar({ stockInfo, stockRealtime, reference }: StockInfoSidebarProps) {
  const ceiling = Math.round(reference * 1.07)
  const floor = Math.round(reference * 0.93)

  return (
    <Card className="h-full bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-2xl font-extrabold text-gray-900">{stockInfo.symbol}</CardTitle>
        <p className="text-sm text-gray-600">{stockInfo.shortName}</p>
        <p className="text-xs text-gray-500">{stockInfo.industry} • {stockInfo.exchange}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Giá hiện tại */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="text-xs text-gray-500 mb-1">Price Now</div>
          <div className={`text-3xl font-extrabold text-center ${
            stockRealtime.change_percent >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {stockRealtime.price.toLocaleString()} VND
          </div>
          <div className={`text-sm font-extrabold text-center mt-1 ${
            stockRealtime.change_percent >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {stockRealtime.change >= 0 ? '↑' : '↓'} {stockRealtime.change >= 0 ? '+' : ''}{stockRealtime.change.toFixed(2)} ({stockRealtime.change_percent >= 0 ? '+' : ''}{stockRealtime.change_percent.toFixed(2)}%)
          </div>
        </div>

        {/* TC, Trần, Sàn */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="bg-gray-50 rounded p-3 border border-blue-200">
            <div className="text-gray-500 text-xs mb-1 text-center">TC</div>
            <div className="font-extrabold text-center text-blue-600 text-lg">{reference.toLocaleString()}</div>
          </div>
          <div className="bg-gray-50 rounded p-3 border border-blue-200">
            <div className="text-gray-500 text-xs mb-1 text-center">CEILING</div>
            <div className="font-extrabold text-center text-blue-600 text-lg">{ceiling.toLocaleString()}</div>
          </div>
          <div className="bg-gray-50 rounded p-3 border border-amber-200">
            <div className="text-gray-500 text-xs mb-1 text-center">FLOOR</div>
            <div className="font-extrabold text-center text-amber-600 text-lg">{floor.toLocaleString()}</div>
          </div>
        </div>
        
        {/* Thông tin cơ bản */}
        <div className="space-y-2 text-sm border-t border-gray-200 pt-4">
          <div className="flex justify-between">
            <span className="text-gray-500">Industry</span>
            <span className="font-extrabold text-[16px] text-gray-700">{stockInfo.industry || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Exchange</span>
            <span className="font-extrabold text-[16px] text-gray-700">{stockInfo.exchange}</span>
          </div>
          {stockInfo.trailingPE && (
            <div className="flex justify-between">
              <span className="text-gray-500">P/E</span>
              <span className="font-extrabold text-[16px] text-gray-700">{stockInfo.trailingPE.toFixed(2)}</span>
            </div>
          )}
          {stockInfo.priceToBook && (
            <div className="flex justify-between">
              <span className="text-gray-500">P/B</span>
              <span className="font-extrabold text-[16px] text-gray-700">{stockInfo.priceToBook.toFixed(2)}</span>
            </div>
          )}
          {stockInfo.returnOnEquity && (
            <div className="flex justify-between">
              <span className="text-gray-500">ROE (%)</span>
              <span className="font-extrabold text-[16px] text-gray-700">{(stockInfo.returnOnEquity * 100).toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Khối lượng */}
        <div className="space-y-2 text-sm border-t border-gray-200 pt-4">
          <div className="flex justify-between">
            <span className="text-gray-500">Total Volume</span>
            <span className="font-extrabold text-[16px] text-blue-600">{stockRealtime.day_volume.toLocaleString()}</span>
          </div>
          {stockInfo.averageVolume && (
            <div className="flex justify-between">
              <span className="text-gray-500">Average Volume</span>
              <span className="font-extrabold text-[16px] text-gray-700">{stockInfo.averageVolume.toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* EPS */}
        {stockInfo.epsTrailingTwelveMonths && (
          <div className="space-y-2 text-sm border-t border-gray-200 pt-4">
            <div className="flex justify-between">
              <span className="text-gray-500">EPS (VND)</span>
              <span className="font-extrabold text-[16px] text-gray-700">{stockInfo.epsTrailingTwelveMonths.toLocaleString()}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

