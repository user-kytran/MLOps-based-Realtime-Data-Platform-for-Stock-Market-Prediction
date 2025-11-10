"use client"

import { StockChart, HistoricalChart } from "@/components/charts"
import { AIPrediction } from "@/components/charts/ai-prediction"
import { FinancialData } from "@/components/market/financial-data"
import { StockNews } from "@/components/news/stock-news"
import { Header } from "@/components/layout/header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StockHeader, StockInfoSidebar, MatchedOrdersSidebar, StockCompanyInfo, StockFinancialInfo, StockStatistics } from "@/components/stock"
import { useStockData } from "@/hooks/useStockData"

export default function StockDetailPage({ params }: { params: { symbol: string } }) {
  const symbol = params.symbol.toUpperCase()
  const { stockInfo, stockRealtime, reference, matchedOrders, loading, error } = useStockData(symbol)

  if (loading && !error) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/img_bg.png')",
            opacity: 0.1,
            zIndex: -1, 
          }}
        ></div>

        <Header />
        <div className="container mx-auto px-4 py-8 text-center relative z-10">
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    )
  }

  if (error && !loading) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/img_bg.png')",
            opacity: 0.1,
            zIndex: -1, 
          }}
        ></div>

        <Header />
        <div className="container mx-auto px-4 py-8 text-center relative z-10">
          <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-8 max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{symbol}</h1>
            <p className="text-xl text-red-600 mb-6">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!stockInfo || !stockRealtime) {
    return null
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('/img_bg.png')",
          opacity: 0.1,
          zIndex: -1, 
        }}
      ></div>

      <Header />

      <div className="w-full px-4 py-4 relative z-10">
        <StockHeader symbol={stockInfo.symbol} name={stockInfo.shortName} />

        <Tabs defaultValue="trading" className="w-full">
          <TabsList className="mb-6 w-full justify-center bg-white/95 backdrop-blur-sm border border-gray-200 overflow-x-auto shadow-sm">
            <TabsTrigger value="trading" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-700 hover:text-gray-900 hover:bg-cyan-100 transition-all duration-200 px-6 py-2">Trading</TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-700 hover:text-gray-900 hover:bg-cyan-100 transition-all duration-200 px-6 py-2">History</TabsTrigger>
            <TabsTrigger value="statistics" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-700 hover:text-gray-900 hover:bg-cyan-100 transition-all duration-200 px-6 py-2">Statistics</TabsTrigger>
            <TabsTrigger value="financial" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-700 hover:text-gray-900 hover:bg-cyan-100 transition-all duration-200 px-6 py-2">Financial</TabsTrigger>
            <TabsTrigger value="company" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-700 hover:text-gray-900 hover:bg-cyan-100 transition-all duration-200 px-6 py-2">Company</TabsTrigger>
            <TabsTrigger value="ai" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-700 hover:text-gray-900 hover:bg-cyan-100 transition-all duration-200 px-6 py-2">AI</TabsTrigger>
            <TabsTrigger value="news" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-700 hover:text-gray-900 hover:bg-cyan-100 transition-all duration-200 px-6 py-2">News</TabsTrigger>
          </TabsList>

          <TabsContent value="trading" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
              <div className="lg:col-span-3">
                <StockInfoSidebar 
                  stockInfo={stockInfo} 
                  stockRealtime={stockRealtime} 
                  reference={reference} 
                />
              </div>

              <div className="lg:col-span-6">
                <StockChart symbol={stockInfo.symbol} referencePrice={reference} stockInfo={stockInfo} />
              </div>

              <div className="lg:col-span-3">
                <MatchedOrdersSidebar matchedOrders={matchedOrders} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history">
            <HistoricalChart symbol={stockInfo.symbol} />
          </TabsContent>

          <TabsContent value="statistics">
            <StockStatistics stockInfo={stockInfo} />
          </TabsContent>

          <TabsContent value="financial">
            <StockFinancialInfo stockInfo={stockInfo} />
          </TabsContent>

          <TabsContent value="company">
            <StockCompanyInfo stockInfo={stockInfo} />
          </TabsContent>

          <TabsContent value="ai">
            <AIPrediction symbol={stockInfo.symbol} />
          </TabsContent>

          <TabsContent value="news">
            <StockNews symbol={stockInfo.symbol} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
