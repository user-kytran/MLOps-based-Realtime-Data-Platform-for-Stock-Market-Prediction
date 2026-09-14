"use client"

import dynamic from "next/dynamic"
import { Header } from "@/components/layout/header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StockHeader, StockInfoSidebar, MatchedOrdersSidebar } from "@/components/stock"
import { useStockData } from "@/hooks/useStockData"
import { AuthGuard } from "@/components/auth"
import { useState, useEffect, useMemo } from "react"
import { useOnboarding } from "@/lib/onboardingContext"
import type { StockInfo } from "@/types/stock"

const StockChart = dynamic(() => import("@/components/charts/stock-chart").then(m => ({ default: m.StockChart })), { ssr: false })
const HistoricalChart = dynamic(() => import("@/components/charts/historical-chart").then(m => ({ default: m.HistoricalChart })), { ssr: false })
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

  // Fallback tạm thời cho tab Trading hiển thị ngay trong < 100ms
  // Khi stockInfo tải xong ở chế độ nền (background), React sẽ tự động re-render cập nhật đầy đủ
  const effectiveStockInfo: StockInfo = useMemo(() => {
    if (stockInfo) return stockInfo
    return {
      symbol,
      shortName: symbol,
      longName: symbol,
      exchange: "HOSE",
      currency: "VND",
      currentPrice: stockRealtime?.price || reference,
      previousClose: reference,
      open: reference,
      dayLow: reference,
      dayHigh: reference,
      volume: stockRealtime?.day_volume || 0,
      averageVolume: 0,
    }
  }, [stockInfo, symbol, stockRealtime?.price, stockRealtime?.day_volume, reference])

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

  const hasRealtimeData = !!stockRealtime || reference > 0;

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
        <StockHeader symbol={effectiveStockInfo.symbol} name={effectiveStockInfo.shortName} />

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
                  stockInfo={effectiveStockInfo} 
                  stockRealtime={stockRealtime} 
                  reference={reference} 
                />
              </div>

              <div className="lg:col-span-6">
                {hasRealtimeData ? (
                  <StockChart symbol={effectiveStockInfo.symbol} referencePrice={reference} stockInfo={effectiveStockInfo} />
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
            {selectedTab === "history" && <HistoricalChart symbol={effectiveStockInfo.symbol} />}
          </TabsContent>

          <TabsContent value="statistics">
            {selectedTab === "statistics" && (
              stockInfo ? (
                <StockStatistics stockInfo={stockInfo} />
              ) : (
                <div className="flex h-[320px] items-center justify-center text-xs font-semibold text-slate-400 bg-white/95 rounded-xl border border-gray-200 shadow-sm">
                  Loading market statistics for {symbol}...
                </div>
              )
            )}
          </TabsContent>

          <TabsContent value="financial">
            {selectedTab === "financial" && (
              stockInfo ? (
                <StockFinancialInfo stockInfo={stockInfo} />
              ) : (
                <div className="flex h-[320px] items-center justify-center text-xs font-semibold text-slate-400 bg-white/95 rounded-xl border border-gray-200 shadow-sm">
                  Loading financial statements for {symbol}...
                </div>
              )
            )}
          </TabsContent>

          <TabsContent value="company">
            {selectedTab === "company" && (
              stockInfo ? (
                <StockCompanyInfo stockInfo={stockInfo} />
              ) : (
                <div className="flex h-[320px] items-center justify-center text-xs font-semibold text-slate-400 bg-white/95 rounded-xl border border-gray-200 shadow-sm">
                  Loading corporate profile for {symbol}...
                </div>
              )
            )}
          </TabsContent>

          <TabsContent value="predict">
            {selectedTab === "predict" && <StockPrediction symbol={effectiveStockInfo.symbol} />}
          </TabsContent>

          <TabsContent value="news">
            {selectedTab === "news" && <StockNews symbol={effectiveStockInfo.symbol} />}
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
