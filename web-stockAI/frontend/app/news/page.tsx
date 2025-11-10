"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { NewsFilters } from "@/components/news/news-filters"
import { NewsList } from "@/components/news/news-list"
import { NewsStatistics } from "@/components/news/news-statistics"

export default function NewsPage() {
  const [filters, setFilters] = useState({
    sector: "all",
    timeFilter: "today",
    searchQuery: "",
    fromDate: "",
    toDate: ""
  })

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
        {/* Page Header */}
        <section className="text-center mb-12">
          <h1 className="text-black text-4xl md:text-6xl font-extrabold mb-4 text-balance">
            NEWS & 
            <span className="text-cyan-900"> ANALYSIS</span>
          </h1>
          <p className="text-black text-xl font-extrabold mb-8 text-pretty max-w-2xl mx-auto py-5">
            Update news and analysis of the stock market
          </p>
        </section>

        {/* News Filters */}
        <NewsFilters filters={filters} setFilters={setFilters} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8 **w-full**">
          {/* Left Column - News List */}
          <div className="lg:col-span-2">
            <NewsList filters={filters} />
          </div>

          {/* Right Column - Statistics */}
          <div className="space-y-8">
            <NewsStatistics filters={filters} />
          </div>
        </div>
      </main>
    </div>
  )
}
