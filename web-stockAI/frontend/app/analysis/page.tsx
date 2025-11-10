"use client"

import { Header } from "@/components/layout/header"
import { MarketSummary } from "@/components/analysis/market-summary"
import { TopVolumeChart } from "@/components/analysis/top-volume-chart"
import { PriceChangeChart } from "@/components/analysis/price-change-chart"
import { SectorDistribution } from "@/components/analysis/sector-distribution"
import { SectorVolumeDetail } from "@/components/analysis/sector-volume-detail"
import { SectorPriceTrend } from "@/components/analysis/sector-price-trend"
import { BarChart3 } from "lucide-react"

export default function AnalysisPage() {
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

      <main className="w-full px-4 py-20 relative z-10">
        <section className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <BarChart3 className="h-12 w-12 text-cyan-600" />
            <h1 className="text-black text-4xl md:text-6xl font-extrabold text-balance">
              MARKET 
              <span className="text-cyan-900"> ANALYSIS</span>
            </h1>
          </div>
          <p className="text-black text-xl font-extrabold mb-8 text-pretty max-w-2xl mx-auto py-5">
            Deep analysis of the Vietnamese stock market
          </p>
        </section>

        <div className="space-y-8 max-w-7xl mx-auto">
          <MarketSummary />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <PriceChangeChart />
            <TopVolumeChart />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-7 gap-8">
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
  )
}

