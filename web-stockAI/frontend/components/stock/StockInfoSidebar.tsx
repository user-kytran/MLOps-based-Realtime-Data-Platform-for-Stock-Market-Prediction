import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { StockInfo, StockRealtime } from "@/types/stock"

interface StockInfoSidebarProps {
  stockInfo: StockInfo
  stockRealtime: StockRealtime | null | undefined // Cập nhật type để phản ánh khả năng là null/undefined
  reference: number
}

// Bước giá HOSE theo quy định HSX
function getHoseTickSize(price: number): number {
  if (price < 10000) return 10;
  if (price < 50000) return 50;
  return 100;
}

// Tính giá trần/sàn HOSE ±7% + làm tròn theo bước giá
function calcLimitPrice(reference: number, isCeiling: boolean): number {
  if (reference === 0) return 0;
  const raw = reference * (isCeiling ? 1.07 : 0.93);
  const tick = getHoseTickSize(raw);
  return isCeiling
    ? Math.ceil(raw / tick) * tick
    : Math.floor(raw / tick) * tick;
}

export function StockInfoSidebar({ stockInfo, stockRealtime, reference }: StockInfoSidebarProps) {
  const ceiling = calcLimitPrice(reference, true)
  const floor = calcLimitPrice(reference, false)
  const displayPrice = stockRealtime?.price ?? stockInfo.currentPrice ?? reference;
  const displayChangePercent = stockRealtime?.change_percent ?? 0;
  const displayChange = stockRealtime?.change ?? 0;
  const displayDayVolume = stockRealtime?.day_volume ?? 0;
  const priceColorClass = displayChangePercent >= 0 ? 'text-green-600' : 'text-red-600';

  return (
    <Card className="h-full bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold text-gray-900">{stockInfo.symbol}</CardTitle>
        <p className="text-sm text-gray-600">{stockInfo.shortName}</p>
        <p className="text-xs text-gray-500">{stockInfo.industry} • {stockInfo.exchange}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Giá hiện tại */}
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <div className="text-xs text-gray-500 mb-1">Price Now</div>
          <div className={`text-2xl font-extrabold text-center ${priceColorClass}`}>
            {displayPrice.toLocaleString()} VND
          </div>
          <div className={`text-sm font-extrabold text-center mt-1 ${priceColorClass}`}>
            {displayChange >= 0 ? '↑' : '↓'} {displayChange >= 0 ? '+' : ''}{displayChange.toFixed(2)} ({displayChangePercent >= 0 ? '+' : ''}{displayChangePercent.toFixed(2)}%)
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-gray-50 rounded p-2 border border-blue-200">
            <div className="text-gray-500 text-xs mb-1 text-center">TC</div>
            <div className="font-extrabold text-center text-blue-600 text-sm">{reference.toLocaleString()}</div>
          </div>
          <div className="bg-gray-50 rounded p-2 border border-red-200"> {/* Đổi border sang red cho CEILING */}
            <div className="text-gray-500 text-xs mb-1 text-center">CEILING</div>
            <div className="font-extrabold text-center text-red-600 text-sm">{ceiling.toLocaleString()}</div> {/* Đổi màu text sang red */}
          </div>
          <div className="bg-gray-50 rounded p-2 border border-cyan-200"> {/* Đổi border sang cyan/blue cho FLOOR */}
            <div className="text-gray-500 text-xs mb-1 text-center">FLOOR</div>
            <div className="font-extrabold text-center text-cyan-600 text-sm">{floor.toLocaleString()}</div> {/* Đổi màu text sang cyan/blue */}
          </div>
        </div>
        <div className="space-y-2 text-xs border-t border-gray-200 pt-3">
          <div className="flex justify-between">
            <span className="text-gray-500">Industry</span>
            <span className="font-extrabold text-sm text-gray-700">{stockInfo.industry || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Exchange</span>
            <span className="font-extrabold text-sm text-gray-700">{stockInfo.exchange}</span>
          </div>
          {stockInfo.trailingPE && (
            <div className="flex justify-between">
              <span className="text-gray-500">P/E</span>
              <span className="font-extrabold text-sm text-gray-700">{stockInfo.trailingPE.toFixed(2)}</span>
            </div>
          )}
          {stockInfo.priceToBook && (
            <div className="flex justify-between">
              <span className="text-gray-500">P/B</span>
              <span className="font-extrabold text-sm text-gray-700">{stockInfo.priceToBook.toFixed(2)}</span>
            </div>
          )}
          {stockInfo.returnOnEquity && (
            <div className="flex justify-between">
              <span className="text-gray-500">ROE (%)</span>
              <span className="font-extrabold text-sm text-gray-700">{(stockInfo.returnOnEquity * 100).toFixed(2)}</span>
            </div>
          )}
        </div>
        <div className="space-y-2 text-xs border-t border-gray-200 pt-3">
          <div className="flex justify-between">
            <span className="text-gray-500">Total Volume</span>
            <span className="font-extrabold text-sm text-blue-600">{displayDayVolume.toLocaleString()}</span>
          </div>
          {stockInfo.averageVolume && (
            <div className="flex justify-between">
              <span className="text-gray-500">Average Volume</span>
              <span className="font-extrabold text-sm text-gray-700">{stockInfo.averageVolume.toLocaleString()}</span>
            </div>
          )}
        </div>
        {stockInfo.epsTrailingTwelveMonths && (
          <div className="space-y-2 text-xs border-t border-gray-200 pt-3">
            <div className="flex justify-between">
              <span className="text-gray-500">EPS (VND)</span>
              <span className="font-extrabold text-sm text-gray-700">{stockInfo.epsTrailingTwelveMonths.toLocaleString()}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
