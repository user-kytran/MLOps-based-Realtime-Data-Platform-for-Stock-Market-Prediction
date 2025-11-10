import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { StockInfo } from "@/types/stock"

interface StockFinancialInfoProps {
  stockInfo: StockInfo
}

export function StockFinancialInfo({ stockInfo }: StockFinancialInfoProps) {
  const formatCurrency = (value?: number) => {
    if (!value) return 'N/A'
    if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
    return value.toLocaleString()
  }

  const formatPercent = (value?: number) => {
    if (!value && value !== 0) return 'N/A'
    return `${(value * 100).toFixed(2)}%`
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-gray-900 text-2xl font-extrabold">Valuation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {stockInfo.marketCap && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="text-sm text-gray-500 mb-1 text-center">Market Cap</div>
                <div className="text-[20px] font-extrabold text-blue-600 text-center">{formatCurrency(stockInfo.marketCap)}</div>
              </div>
            )}
            {stockInfo.enterpriseValue && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="text-sm text-gray-500 mb-1 text-center">Enterprise Value</div>
                <div className="text-[20px] font-extrabold text-blue-600 text-center">{formatCurrency(stockInfo.enterpriseValue)}</div>
              </div>
            )}
            {stockInfo.trailingPE && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="text-sm text-gray-500 mb-1 text-center">Trailing P/E</div>
                <div className="text-[20px] font-extrabold text-green-600 text-center">{stockInfo.trailingPE.toFixed(2)}</div>
              </div>
            )}
            {stockInfo.priceToBook && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="text-sm text-gray-500 mb-1 text-center">Trailing P/B</div>
                <div className="text-[20px] font-extrabold text-green-600 text-center">{stockInfo.priceToBook.toFixed(2)}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-gray-900 text-2xl font-extrabold">Dividends</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {stockInfo.dividendRate && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="text-xs text-gray-500 mb-1 text-center">Dividend Rate</div>
                <div className="text-[20px] font-extrabold text-purple-600 text-center">{stockInfo.dividendRate.toLocaleString()}</div>
              </div>
            )}
            {stockInfo.dividendYield && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="text-xs text-gray-500 mb-1 text-center">Dividend Yield</div>
                <div className="text-[20px] font-extrabold text-purple-600 text-center">{formatPercent(stockInfo.dividendYield)}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-gray-900 text-2xl font-extrabold">Revenue & Profit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stockInfo.totalRevenue && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Total Revenue</span>
              <span className="font-extrabold text-[16px] text-gray-700">{formatCurrency(stockInfo.totalRevenue)}</span>
            </div>
          )}
          {stockInfo.revenuePerShare && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Revenue Per Share</span>
              <span className="font-extrabold text-[16px] text-gray-700">{formatCurrency(stockInfo.revenuePerShare)}</span>
            </div>
          )}
          {stockInfo.revenueGrowth && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Revenue Growth</span>
              <span className={`font-extrabold text-[16px] ${stockInfo.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(stockInfo.revenueGrowth)}
              </span>
            </div>
          )}
          {stockInfo.profitMargins && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Profit Margin</span>
              <span className="font-extrabold text-[16px] text-gray-700">{formatPercent(stockInfo.profitMargins)}</span>
            </div>
          )}
          {stockInfo.grossMargins && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Gross Margin</span>
              <span className="font-extrabold text-[16px] text-gray-700">{formatPercent(stockInfo.grossMargins)}</span>
            </div>
          )}
          {stockInfo.operatingMargins && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Operating Margin</span>
              <span className="font-extrabold text-[16px] text-gray-700">{formatPercent(stockInfo.operatingMargins)}</span>
            </div>
          )}
          {stockInfo.ebitdaMargins && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">EBITDA Margin</span>
              <span className="font-extrabold text-[16px] text-gray-700">{formatPercent(stockInfo.ebitdaMargins)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-gray-900 text-2xl font-extrabold">Efficiency</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stockInfo.returnOnAssets && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Return on Assets</span>
              <span className="font-extrabold text-[16px] text-orange-600">{formatPercent(stockInfo.returnOnAssets)}</span>
            </div>
          )}
          {stockInfo.returnOnEquity && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Return on Equity</span>
              <span className="font-extrabold text-[16px] text-orange-600">{formatPercent(stockInfo.returnOnEquity)}</span>
            </div>
          )}
          {stockInfo.earningsGrowth && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Earnings Growth</span>
              <span className={`font-extrabold text-[16px] ${stockInfo.earningsGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(stockInfo.earningsGrowth)}
              </span>
            </div>
          )}
          {stockInfo.epsTrailingTwelveMonths && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">EPS (12 months)</span>
              <span className="font-extrabold text-[16px] text-gray-700">{stockInfo.epsTrailingTwelveMonths.toLocaleString()}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-gray-900 text-2xl font-extrabold">Assets & Debt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stockInfo.totalCash && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Cash</span>
              <span className="font-extrabold text-[16px] text-gray-700">{formatCurrency(stockInfo.totalCash)}</span>
            </div>
          )}
          {stockInfo.totalDebt && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Total Debt</span>
              <span className="font-extrabold text-[16px] text-gray-700">{formatCurrency(stockInfo.totalDebt)}</span>
            </div>
          )}
          {stockInfo.debtToEquity && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Debt to Equity</span>
              <span className="font-extrabold text-[16px] text-gray-700">{stockInfo.debtToEquity.toFixed(2)}</span>
            </div>
          )}
          {stockInfo.currentRatio && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Current Ratio</span>
              <span className="font-extrabold text-[16px] text-gray-700">{stockInfo.currentRatio.toFixed(2)}</span>
            </div>
          )}
          {stockInfo.quickRatio && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Quick Ratio</span>
              <span className="font-extrabold text-[16px] text-gray-700">{stockInfo.quickRatio.toFixed(2)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-gray-900 text-2xl font-extrabold">Cash Flow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stockInfo.operatingCashflow && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Operating Cash Flow</span>
              <span className="font-extrabold text-[16px] text-gray-700">{formatCurrency(stockInfo.operatingCashflow)}</span>
            </div>
          )}
          {stockInfo.freeCashflow && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Free Cash Flow</span>
              <span className={`font-extrabold text-[16px] ${stockInfo.freeCashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(stockInfo.freeCashflow)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

