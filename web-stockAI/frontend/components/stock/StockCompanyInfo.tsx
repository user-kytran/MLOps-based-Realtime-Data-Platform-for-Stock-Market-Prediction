import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { StockInfo } from "@/types/stock"

interface StockCompanyInfoProps {
  stockInfo: StockInfo
}

export function StockCompanyInfo({ stockInfo }: StockCompanyInfoProps) {
  const formatAddress = () => {
    const parts = []
    if (stockInfo.address1) parts.push(stockInfo.address1)
    if (stockInfo.address2) parts.push(stockInfo.address2)
    if (stockInfo.city) parts.push(stockInfo.city)
    if (stockInfo.country) parts.push(stockInfo.country)
    return parts.join(', ')
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-gray-900 text-2xl font-extrabold">Company Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <div className="text-sm text-gray-500">Full Name</div>
              <div className="text-[16px] font-extrabold text-gray-700">{stockInfo.longName || stockInfo.shortName}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Stock Code</div>
              <div className="text-[16px] font-extrabold text-gray-700">{stockInfo.symbol}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">Exchange</div>
                <div className="text-[16px] font-extrabold text-gray-700">{stockInfo.exchange}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Industry</div>
                <div className="text-[16px] font-extrabold text-gray-700">{stockInfo.industryDisp || stockInfo.industry || 'N/A'}</div>
              </div>
            </div>
            {stockInfo.sector && (
              <div>
                <div className="text-sm text-gray-500">Sector</div>
                <div className="text-[16px] font-extrabold text-gray-700">{stockInfo.sectorDisp || stockInfo.sector}</div>
              </div>
            )}
            {formatAddress() && (
              <div>
                <div className="text-sm text-gray-500">Address</div>
                <div className="text-[16px] font-extrabold text-gray-700">{formatAddress()}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-gray-900 text-2xl font-extrabold">Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {stockInfo.phone && (
              <div>
                <div className="text-sm text-gray-500">Phone</div>
                <div className="text-[16px] font-extrabold text-gray-700">{stockInfo.phone}</div>
              </div>
            )}
            {stockInfo.fullTimeEmployees && (
              <div>
                <div className="text-sm text-gray-500">Number of Employees</div>
                <div className="text-[16px] font-extrabold text-gray-700">{stockInfo.fullTimeEmployees.toLocaleString()} people</div>
              </div>
            )}
            {stockInfo.website && (
              <div>
                <div className="text-sm text-gray-500">Website</div>
                <a 
                  href={stockInfo.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[16px] font-extrabold text-blue-600 hover:underline"
                >
                  {stockInfo.website}
                </a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {stockInfo.longBusinessSummary && (
        <Card className="lg:col-span-2 bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900 text-2xl font-extrabold">Introduction</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[16px] leading-relaxed text-gray-600 text-justify">
              {stockInfo.longBusinessSummary}
            </p>
          </CardContent>
        </Card>
      )}

      {stockInfo.companyOfficers && stockInfo.companyOfficers.length > 0 && (
        <Card className="lg:col-span-2 bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900 text-2xl font-extrabold">Board of Directors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stockInfo.companyOfficers.map((officer, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="text-[16px] font-extrabold text-gray-700">{officer.name}</div>
                  <div className="text-sm text-gray-500 mt-1">{officer.title}</div>
                  {officer.age && <div className="text-xs text-gray-400 mt-1">{officer.age} years old</div>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

