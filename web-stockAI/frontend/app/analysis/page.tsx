"use client"

import dynamic from "next/dynamic"
import { Header } from "@/components/layout/header"
import { AuthGuard } from "@/components/auth"

const MarketSummary = dynamic(() => import("@/components/analysis/market-summary").then(m => ({ default: m.MarketSummary })), { ssr: false })
const TopVolumeChart = dynamic(() => import("@/components/analysis/top-volume-chart").then(m => ({ default: m.TopVolumeChart })), { ssr: false })
const PriceChangeChart = dynamic(() => import("@/components/analysis/price-change-chart").then(m => ({ default: m.PriceChangeChart })), { ssr: false })
const SectorDistribution = dynamic(() => import("@/components/analysis/sector-distribution").then(m => ({ default: m.SectorDistribution })), { ssr: false })
const SectorVolumeDetail = dynamic(() => import("@/components/analysis/sector-volume-detail").then(m => ({ default: m.SectorVolumeDetail })), { ssr: false })
const SectorPriceTrend = dynamic(() => import("@/components/analysis/sector-price-trend").then(m => ({ default: m.SectorPriceTrend })), { ssr: false })
const PredictionSummary = dynamic(() => import("@/components/analysis/prediction-summary").then(m => ({ default: m.PredictionSummary })), { ssr: false })
const PredictionAccuracy = dynamic(() => import("@/components/analysis/prediction-accuracy").then(m => ({ default: m.PredictionAccuracy })), { ssr: false })

export default function AnalysisPage() {
  return (
    <AuthGuard
      title="Market Analysis & AI Accuracy"
      description="Please sign in with Google to access market breadth distribution, sector capital flows, and AI empirical accuracy backtests."
    >
      <div className="min-h-screen relative">
        <div
          className="fixed inset-0 bg-cover bg-center pointer-events-none"
          style={{
            backgroundImage: "url('/img_bg.png')",
            opacity: 0.2,
            zIndex: -1,
          }}
        ></div>

        <Header />

        <main className="w-full px-4 py-5 relative z-10">
          <section className="text-center mb-3">
            <h1 className="text-black text-2xl md:text-3xl font-extrabold mb-2 text-balance">
              MARKET
              <span className="text-cyan-900"> ANALYSIS</span>
            </h1>
            <p className="text-black text-sm font-semibold mb-3 text-pretty max-w-xl mx-auto">
              Deep analysis of the Vietnamese stock market
            </p>
          </section>

          <div className="mx-auto max-w-7xl space-y-4">
            <MarketSummary />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 items-stretch">
              <div className="xl:col-span-5 flex flex-col">
                <PredictionSummary />
              </div>
              <div className="xl:col-span-7 flex flex-col">
                <PredictionAccuracy />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PriceChangeChart />
              <TopVolumeChart />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
              <div className="lg:col-span-3">
                <SectorDistribution />
              </div>
              <div className="lg:col-span-4">
                <SectorVolumeDetail />
              </div>
            </div>

            <SectorPriceTrend />
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}
