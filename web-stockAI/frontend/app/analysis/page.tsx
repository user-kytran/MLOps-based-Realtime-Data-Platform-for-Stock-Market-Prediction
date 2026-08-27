"use client"

import dynamic from "next/dynamic"
import { Header } from "@/components/layout/header"
import { BarChart3 } from "lucide-react"

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
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="w-full px-4 py-5">
        <section className="mb-5 text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <BarChart3 className="h-6 w-6 text-cyan-600" />
            <h1 className="text-2xl font-extrabold text-black text-balance md:text-3xl">
              MARKET
              <span className="text-cyan-900"> ANALYSIS</span>
            </h1>
          </div>
          <p className="mx-auto max-w-2xl text-sm font-semibold text-black text-pretty">
            Deep analysis of the Vietnamese stock market
          </p>
        </section>

        <div className="mx-auto max-w-7xl space-y-4">
          <MarketSummary />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="xl:col-span-5">
              <PredictionSummary />
            </div>
            <div className="xl:col-span-7">
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
  )
}
