import { Header } from "@/components/layout/header"
import { DashboardOverview } from "@/components/dashboard/dashboard-overview"
import { Watchlist } from "@/components/user/watchlist"
import { PortfolioSummary } from "@/components/dashboard/portfolio-summary"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { MarketAlerts } from "@/components/dashboard/market-alerts"
import { usePriceVolumeWS } from "@/hooks/useStocksWS"

export default function DashboardPage() {
  const priceVolume = usePriceVolumeWS();
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">Dashboard</h1>
          <p className="text-xl text-muted-foreground">Theo dõi danh mục đầu tư và cập nhật thị trường của bạn</p>
        </div>

        {/* Realtime Price & Volume */}
        <div className="mb-8">
          <div className="flex items-center gap-8">
            <div className="p-4 rounded bg-card shadow">
              <div className="text-lg font-semibold">Giá realtime</div>
              <div className="text-2xl font-bold text-green-600">{priceVolume?.price ?? "--"}</div>
            </div>
            <div className="p-4 rounded bg-card shadow">
              <div className="text-lg font-semibold">Volume realtime</div>
              <div className="text-2xl font-bold text-blue-600">{priceVolume?.volume ?? "--"}</div>
            </div>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-3 space-y-8">
            <DashboardOverview />
            <Watchlist />
            <RecentActivity />
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-8">
            <PortfolioSummary />
            <MarketAlerts />
          </div>
        </div>
      </main>
    </div>
  )
}
