"use client"

import { Header } from "@/components/layout/header"
import { StockTable } from "@/components/market/stock-table"
import { SearchBar } from "@/components/search/search-bar"
import { TopMovers } from "@/components/market/top-movers"
import { TopVolume } from "@/components/market/top-volume"
import { useStocksRealtimeWS } from "@/hooks/useStocksRealtimeWS"
import { useState } from "react"

export default function StocksPage() {
  const stocks = useStocksRealtimeWS()
  const [mode, setMode] = useState<"ALL" | "VN30">("ALL")
  const [sector, setSector] = useState<string>("all")
  
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('/img_bg.png')",
          opacity: 0.2,
          zIndex: -1, 
        }}
      ></div>

      <Header />

      <main className="w-full px-4 py-5 relative z-10">
        {/* Search and Filter Controls */}
        <div className="w-full mb-8">
          <div className="flex flex-col lg:flex-row items-center gap-4 w-full">
            <div className="px-4 lg:px-6">
              <SearchBar fullWidth noMargin />
            </div>
            
            {/* Filter Controls */}
            <div className="flex items-center gap-3 flex-wrap px-30 lg:px-40">
              <div className="flex items-center gap-2">
                <button
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
                    mode === "ALL" 
                      ? "bg-cyan-700 text-white shadow-sm" 
                      : "text-gray-700 bg-gray-50 border border-gray-200 hover:text-cyan-600 hover:bg-gray-100"
                  }`}
                  onClick={() => setMode("ALL")}
                >
                  ALL STOCKS
                </button>
                <button
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
                    mode === "VN30" 
                      ? "bg-cyan-700 text-white shadow-sm" 
                      : "text-gray-700 bg-gray-50 border border-gray-200 hover:text-cyan-600 hover:bg-gray-100"
                  }`}
                  onClick={() => setMode("VN30")}
                >
                  VN30
                </button>
              </div>
              
              <select
                className="px-4 py-2 rounded-lg font-semibold text-sm bg-white border border-gray-200 text-gray-700 hover:border-cyan-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 transition-all duration-200"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
              >
                <option value="all">All Sectors</option>
                <option value="Consumer_Cyclical">Consumer Cyclical</option>
                <option value="Consumer_Defensive">Consumer Defensive</option>
                <option value="Basic_Materials">Basic Materials</option>
                <option value="Financial_Services">Financial Services</option>
                <option value="Communication_Services">Communication Services</option>
                <option value="Real_Estate">Real Estate</option>
                <option value="Utilities">Utilities</option>
                <option value="Industrials">Industrials</option>
                <option value="Technology">Technology</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Energy">Energy</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 w-full">
          <div className="col-span-1">
            <StockTable mode={mode} sector={sector} />
          </div>
        </div>
      </main>
    </div>
  )
}
