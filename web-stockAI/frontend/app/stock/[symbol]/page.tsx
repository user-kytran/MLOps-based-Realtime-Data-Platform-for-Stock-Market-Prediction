"use client"

import dynamic from "next/dynamic"
import { Header } from "@/components/layout/header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StockHeader, StockInfoSidebar, MatchedOrdersSidebar } from "@/components/stock"
import { useStockData } from "@/hooks/useStockData"
import { AuthGuard } from "@/components/auth"
import { useState, useEffect } from "react"
import { useOnboarding } from "@/lib/onboardingContext"

const StockChart = dynamic(() => import("@/components/charts").then(m => ({ default: m.StockChart })), { ssr: false })
const HistoricalChart = dynamic(() => import("@/components/charts").then(m => ({ default: m.HistoricalChart })), { ssr: false })
const StockPrediction = dynamic(() => import("@/components/charts/stock-prediction").then(m => ({ default: m.StockPrediction })), { ssr: false })
const StockNews = dynamic(() => import("@/components/news/stock-news").then(m => ({ default: m.StockNews })), { ssr: false })
const StockCompanyInfo = dynamic(() => import("@/components/stock").then(m => ({ default: m.StockCompanyInfo })), { ssr: false })
const StockFinancialInfo = dynamic(() => import("@/components/stock").then(m => ({ default: m.StockFinancialInfo })), { ssr: false })
const StockStatistics = dynamic(() => import("@/components/stock").then(m => ({ default: m.StockStatistics })), { ssr: false })

function StockDetailContent({ symbol }: { symbol: string }) {
  const [isMounted, setIsMounted] = useState(false)
  const { stockInfo, stockRealtime, reference, matchedOrders, loading, error } = useStockData(symbol)
  const { activeTabOverride } = useOnboarding()
  const [selectedTab, setSelectedTab] = useState("trading")

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (activeTabOverride) {
      setSelectedTab(activeTabOverride)
    }
  }, [activeTabOverride])

  if (loading && !error) {
    return (
      <div className="min-h-screen relative">
        <div
          className="fixed inset-0 bg-cover bg-center pointer-events-none"
          style={{
            backgroundImage: "url('/img_bg.png')",
            opacity: 0.1,
            zIndex: -1, 
          }}
        ></div>

        <Header />
        <div className="container mx-auto px-4 py-8 text-center relative z-10">
          <p className="text-gray-600">Loading market data for {symbol}...</p>
        </div>
      </div>
    )
  }

  if (error && !loading) {
    return (
      <div className="min-h-screen relative">
        <div
          className="fixed inset-0 bg-cover bg-center pointer-events-none"
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
    return null 
  }

  if (!stockInfo) {
    return (
      <div className="min-h-screen relative">
        <Header />
        <div className="container mx-auto px-4 py-8 text-center relative z-10">
          <p className="text-gray-600">No quote data found or market not in session.</p>
        </div>
      </div>
    )
  }

  const hasRealtimeData = !!stockRealtime;

  return (
    <div className="min-h-screen relative">
      <div
        className="fixed inset-0 bg-cover bg-center pointer-events-none"
        style={{
          backgroundImage: "url('/img_bg.png')",
          opacity: 0.1,
          zIndex: -1, 
        }}
      ></div>

      <Header />

      <div className="w-full px-4 py-4 relative z-10">
        <StockHeader symbol={stockInfo.symbol} name={stockInfo.shortName} />

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <div className="mb-3 overflow-x-auto">
            <TabsList className="min-w-max justify-start border border-gray-200 bg-white/95 shadow-sm backdrop-blur-sm">
              <TabsTrigger value="trading" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-700 hover:text-gray-900 hover:bg-cyan-100 transition-all duration-200 px-3 py-1.5 text-xs font-semibold">Trading</TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-700 hover:text-gray-900 hover:bg-cyan-100 transition-all duration-200 px-3 py-1.5 text-xs font-semibold">History</TabsTrigger>
              <TabsTrigger value="statistics" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-700 hover:text-gray-900 hover:bg-cyan-100 transition-all duration-200 px-3 py-1.5 text-xs font-semibold">Statistics</TabsTrigger>
              <TabsTrigger value="financial" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-700 hover:text-gray-900 hover:bg-cyan-100 transition-all duration-200 px-3 py-1.5 text-xs font-semibold">Financial</TabsTrigger>
              <TabsTrigger value="company" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-700 hover:text-gray-900 hover:bg-cyan-100 transition-all duration-200 px-3 py-1.5 text-xs font-semibold">Company</TabsTrigger>
              <TabsTrigger value="predict" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-700 hover:text-gray-900 hover:bg-cyan-100 transition-all duration-200 px-3 py-1.5 text-xs font-semibold">Predict</TabsTrigger>
              <TabsTrigger value="news" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-gray-700 hover:text-gray-900 hover:bg-cyan-100 transition-all duration-200 px-3 py-1.5 text-xs font-semibold">News</TabsTrigger>
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
                {hasRealtimeData ? (
                  <StockChart symbol={stockInfo.symbol} referencePrice={reference} stockInfo={stockInfo} />
                ) : (
                  <div className="h-[400px] flex items-center justify-center bg-gray-50 rounded-lg border border-dashed text-gray-500">
                    <p>Real-time chart currently unavailable.</p>
                  </div>
                )}
              </div>

              <div className="lg:col-span-3">
                {hasRealtimeData ? (
                  <MatchedOrdersSidebar matchedOrders={matchedOrders} />
                ) : (
                  <div className="h-[400px] flex items-center justify-center bg-gray-50 rounded-lg border border-dashed text-gray-500">
                    <p>Matched order feed currently unavailable.</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history">
            {selectedTab === "history" && <HistoricalChart symbol={stockInfo.symbol} />}
          </TabsContent>

          <TabsContent value="statistics">
            {selectedTab === "statistics" && <StockStatistics stockInfo={stockInfo} />}
          </TabsContent>

          <TabsContent value="financial">
            {selectedTab === "financial" && <StockFinancialInfo stockInfo={stockInfo} />}
          </TabsContent>

          <TabsContent value="company">
            {selectedTab === "company" && <StockCompanyInfo stockInfo={stockInfo} />}
          </TabsContent>

          <TabsContent value="predict">
            {selectedTab === "predict" && <StockPrediction symbol={stockInfo.symbol} />}
          </TabsContent>

          <TabsContent value="news">
            {selectedTab === "news" && <StockNews symbol={stockInfo.symbol} />}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default function StockDetailPage({ params }: { params: { symbol: string } }) {
  const symbol = params.symbol.toUpperCase()

  return (
    <AuthGuard
      title={`Stock Overview & AI Forecast: ${symbol}`}
      description={`Please sign in with Google to view real-time charts, order book, and AI price prediction models for ${symbol}.`}
    >
      <StockDetailContent symbol={symbol} />
    </AuthGuard>
  )
}
