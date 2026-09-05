import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { StockInfo } from "@/types/stock"

interface StockStatisticsProps {
  stockInfo: StockInfo
}

export function StockStatistics({ stockInfo }: StockStatisticsProps) {
  const formatCurrency = (value?: number) => {
    if (!value) return 'N/A'
    return value.toLocaleString()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-gray-900 text-sm font-bold">Price Trading</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Current Price</span>
            <span className="font-extrabold text-sm font-mono text-blue-600">{formatCurrency(stockInfo.currentPrice)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Previous Close</span>
            <span className="font-extrabold text-sm font-mono text-gray-700">{formatCurrency(stockInfo.previousClose)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Open Price</span>
            <span className="font-extrabold text-sm font-mono text-gray-700">{formatCurrency(stockInfo.open)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Low Price</span>
            <span className="font-extrabold text-sm font-mono text-gray-700">{formatCurrency(stockInfo.dayLow)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">High Price</span>
            <span className="font-extrabold text-sm font-mono text-gray-700">{formatCurrency(stockInfo.dayHigh)}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-gray-900 text-sm font-bold">Trading Volume</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Volume</span>
            <span className="font-extrabold text-sm font-mono text-blue-600">{formatCurrency(stockInfo.volume)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Average Volume</span>
            <span className="font-extrabold text-sm font-mono text-gray-700">{formatCurrency(stockInfo.averageVolume)}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-gray-900 text-sm font-bold">52 weeks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stockInfo.fiftyTwoWeekLow && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Lowest 52 weeks</span>
              <span className="font-bold text-sm font-mono text-rose-600">{formatCurrency(stockInfo.fiftyTwoWeekLow)}</span>
            </div>
          )}
          {stockInfo.fiftyTwoWeekHigh && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Highest 52 weeks</span>
              <span className="font-bold text-sm font-mono text-emerald-600">{formatCurrency(stockInfo.fiftyTwoWeekHigh)}</span>
            </div>
          )}
          {stockInfo.fiftyTwoWeekLow && stockInfo.fiftyTwoWeekHigh && (
            <div className="mt-4 pt-1">
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>52 weeks range</span>
                <span className="font-medium text-slate-700">Current: <strong className="text-slate-900">{formatCurrency(stockInfo.currentPrice)}</strong></span>
              </div>
              <div className="relative h-2.5 bg-slate-200 rounded-full overflow-visible">
                <div 
                  className="absolute h-full rounded-full bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-500"
                  style={{
                    left: 0,
                    right: 0,
                    width: '100%'
                  }}
                />
                <div 
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
                  style={{
                    left: `${Math.max(0, Math.min(100, ((stockInfo.currentPrice - stockInfo.fiftyTwoWeekLow) / (stockInfo.fiftyTwoWeekHigh - stockInfo.fiftyTwoWeekLow)) * 100))}%`
                  }}
                >
                  <div className="w-3.5 h-3.5 bg-slate-900 border-2 border-white rounded-full shadow-md" />
                </div>
              </div>
              <div className="flex justify-between text-[11px] text-gray-400 mt-2 font-mono">
                <span>Low: {formatCurrency(stockInfo.fiftyTwoWeekLow)}</span>
                <span>High: {formatCurrency(stockInfo.fiftyTwoWeekHigh)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-gray-900 text-sm font-bold">Moving Average</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stockInfo.fiftyDayAverage && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">50 days average</span>
              <span className="font-extrabold text-sm font-mono text-gray-700">{formatCurrency(stockInfo.fiftyDayAverage)}</span>
            </div>
          )}
          {stockInfo.twoHundredDayAverage && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">200 days average</span>
              <span className="font-extrabold text-sm font-mono text-gray-700">{formatCurrency(stockInfo.twoHundredDayAverage)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-gray-900 text-sm font-bold">Shares</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stockInfo.sharesOutstanding && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Shares Outstanding</span>
              <span className="font-extrabold text-sm font-mono text-gray-700">{formatCurrency(stockInfo.sharesOutstanding)}</span>
            </div>
          )}
          {stockInfo.floatShares && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Float Shares</span>
              <span className="font-extrabold text-sm font-mono text-gray-700">{formatCurrency(stockInfo.floatShares)}</span>
            </div>
          )}
          {stockInfo.heldPercentInsiders && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">% Held by Insiders</span>
              <span className="font-extrabold text-sm font-mono text-gray-700">{(stockInfo.heldPercentInsiders * 100).toFixed(2)}%</span>
            </div>
          )}
          {stockInfo.heldPercentInstitutions && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">% Held by Institutions</span>
              <span className="font-extrabold text-sm font-mono text-gray-700">{(stockInfo.heldPercentInstitutions * 100).toFixed(2)}%</span>
            </div>
          )}
          {stockInfo.bookValue && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Book Value</span>
              <span className="font-extrabold text-sm font-mono text-gray-700">{formatCurrency(stockInfo.bookValue)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {stockInfo.beta && (
        <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900 text-sm font-bold">Risk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Beta</span>
              <span className="font-extrabold text-sm font-mono text-orange-600">{stockInfo.beta.toFixed(3)}</span>
            </div>
            <div className="text-xs text-gray-400 mt-2">
              Beta measures the volatility of the stock compared to the market. 
              Beta &gt; 1: Volatility higher than the market. 
              Beta &lt; 1: Volatility lower than the market.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

