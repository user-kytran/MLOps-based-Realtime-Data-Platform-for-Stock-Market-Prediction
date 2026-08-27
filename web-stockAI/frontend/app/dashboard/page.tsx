"use client"

import dynamic from "next/dynamic"
import { Header } from "@/components/layout/header"
import { usePriceVolumeWS } from "@/hooks/useStocksWS"

const DashboardOverview = dynamic(() => import("@/components/dashboard/dashboard-overview").then(m => ({ default: m.DashboardOverview })), { ssr: false })
const Watchlist = dynamic(() => import("@/components/user/watchlist").then(m => ({ default: m.Watchlist })), { ssr: false })
const PortfolioSummary = dynamic(() => import("@/components/dashboard/portfolio-summary").then(m => ({ default: m.PortfolioSummary })), { ssr: false })
const RecentActivity = dynamic(() => import("@/components/dashboard/recent-activity").then(m => ({ default: m.RecentActivity })), { ssr: false })
const MarketAlerts = dynamic(() => import("@/components/dashboard/market-alerts").then(m => ({ default: m.MarketAlerts })), { ssr: false })

export default function DashboardPage() {
  const priceVolume = usePriceVolumeWS();
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-5">
        <div className="mb-4">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Theo dõi danh mục đầu tư và cập nhật thị trường của bạn</p>
        </div>

        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="p-3 rounded bg-card shadow">
              <div className="text-xs font-semibold">Giá realtime</div>
              <div className="text-xl font-bold text-green-600">{priceVolume?.price ?? "--"}</div>
            </div>
            <div className="p-3 rounded bg-card shadow">
              <div className="text-xs font-semibold">Volume realtime</div>
              <div className="text-xl font-bold text-blue-600">{priceVolume?.volume ?? "--"}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3 space-y-4">
            <DashboardOverview />
            <Watchlist />
            <RecentActivity />
          </div>
          <div className="space-y-4">
            <PortfolioSummary />
            <MarketAlerts />
          </div>
        </div>
      </main>
    </div>
  )
}
