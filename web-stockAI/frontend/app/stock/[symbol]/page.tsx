"use client"

import dynamic from "next/dynamic"
import { Header } from "@/components/layout/header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StockHeader, StockInfoSidebar, MatchedOrdersSidebar } from "@/components/stock"
import { useStockData } from "@/hooks/useStockData"
import { useState, useEffect } from "react"

const StockChart = dynamic(() => import("@/components/charts").then(m => ({ default: m.StockChart })), { ssr: false })
const HistoricalChart = dynamic(() => import("@/components/charts").then(m => ({ default: m.HistoricalChart })), { ssr: false })
const StockPrediction = dynamic(() => import("@/components/charts/stock-prediction").then(m => ({ default: m.StockPrediction })), { ssr: false })
const StockNews = dynamic(() => import("@/components/news/stock-news").then(m => ({ default: m.StockNews })), { ssr: false })
const StockCompanyInfo = dynamic(() => import("@/components/stock").then(m => ({ default: m.StockCompanyInfo })), { ssr: false })
const StockFinancialInfo = dynamic(() => import("@/components/stock").then(m => ({ default: m.StockFinancialInfo })), { ssr: false })
const StockStatistics = dynamic(() => import("@/components/stock").then(m => ({ default: m.StockStatistics })), { ssr: false })

export default function StockDetailPage({ params }: { params: { symbol: string } }) {
  const [isMounted, setIsMounted] = useState(false)
  const symbol = params.symbol.toUpperCase()
  const { stockInfo, stockRealtime, reference, matchedOrders, loading, error } = useStockData(symbol)

  useEffect(() => {
    setIsMounted(true)
  }, [])

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
          <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{symbol}</h1>
            <p className="text-sm text-red-600 mb-4">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isMounted) {
    // Có thể trả về null, hoặc một div loading rất đơn giản, không gây mismatch
    return null 
  }

  if (!stockInfo) {
    return (
        <div className="min-h-screen relative overflow-hidden">
            <Header />
            <div className="container mx-auto px-4 py-8 text-center relative z-10">
                <p className="text-gray-600">Không tìm thấy dữ liệu hoặc thị trường chưa mở.</p>
            </div>
        </div>
    )
  }

  const hasRealtimeData = !!stockRealtime;

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
          <div className="mb-3 overflow-x-auto">
            <TabsList className="min-w-max justify-start border border-gray-200 bg-white/95 shadow-sm backdrop-blur-sm">
              <TabsTrigger value="trading" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-700 hover:text-gray-900 hover:bg-cyan-100 transition-all duration-200 px-3 py-1.5 text-xs">Trading</TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-700 hover:text-gray-900 hover:bg-cyan-100 transition-all duration-200 px-3 py-1.5 text-xs">History</TabsTrigger>
              <TabsTrigger value="statistics" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-700 hover:text-gray-900 hover:bg-cyan-100 transition-all duration-200 px-3 py-1.5 text-xs">Statistics</TabsTrigger>
              <TabsTrigger value="financial" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-700 hover:text-gray-900 hover:bg-cyan-100 transition-all duration-200 px-3 py-1.5 text-xs">Financial</TabsTrigger>
              <TabsTrigger value="company" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-700 hover:text-gray-900 hover:bg-cyan-100 transition-all duration-200 px-3 py-1.5 text-xs">Company</TabsTrigger>
              <TabsTrigger value="predict" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-700 hover:text-gray-900 hover:bg-cyan-100 transition-all duration-200 px-3 py-1.5 text-xs">Predict</TabsTrigger>
              <TabsTrigger value="news" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-700 hover:text-gray-900 hover:bg-cyan-100 transition-all duration-200 px-3 py-1.5 text-xs">News</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="trading" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[560px]">
              <div className="lg:col-span-3">
                <StockInfoSidebar 
                  stockInfo={stockInfo} 
                  stockRealtime={stockRealtime} 
                  reference={reference} 
                />
              </div>

              <div className="lg:col-span-6">
                {/* <StockChart symbol={stockInfo.symbol} referencePrice={reference} stockInfo={stockInfo} /> */}
                {hasRealtimeData ? (
                 <StockChart symbol={stockInfo.symbol} referencePrice={reference} stockInfo={stockInfo} />
                ) : (
                    <div className="h-[400px] flex items-center justify-center bg-gray-50 rounded-lg border border-dashed text-gray-500">
                        <p>Biểu đồ realtime không khả dụng.</p>
                    </div>
                )}
              </div>

              <div className="lg:col-span-3">
                {/* <MatchedOrdersSidebar matchedOrders={matchedOrders} /> */}
                {hasRealtimeData ? (
                  <MatchedOrdersSidebar matchedOrders={matchedOrders} />
                ) : (
                    <div className="h-[400px] flex items-center justify-center bg-gray-50 rounded-lg border border-dashed text-gray-500">
                        <p>Sổ lệnh realtime không khả dụng.</p>
                    </div>
                )}
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

          <TabsContent value="predict">
            <StockPrediction symbol={stockInfo.symbol} />
          </TabsContent>

          <TabsContent value="news">
            <StockNews symbol={stockInfo.symbol} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
