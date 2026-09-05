"use client"

import React, { useEffect } from "react"
import { useOnboarding } from "@/lib/onboardingContext"

export function WelcomeModal() {
  const { isWelcomeOpen, closeWelcome, startTour } = useOnboarding()

  // Support ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isWelcomeOpen) {
        closeWelcome()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isWelcomeOpen, closeWelcome])

  if (!isWelcomeOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in-0 duration-200">
      {/* Gentle transparent backdrop that keeps underlying page visible */}
      <div
        className="fixed inset-0 bg-slate-900/25 backdrop-blur-[2px] transition-opacity"
        onClick={closeWelcome}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg rounded-xl bg-white/95 backdrop-blur-md p-5 sm:p-6 shadow-xl border border-gray-200/90 z-10 animate-in zoom-in-95 duration-150 text-gray-900">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="inline-flex items-center gap-1.5">
            <span className="inline-flex items-center rounded-md border font-medium text-[10px] px-2 py-0.5 bg-gray-100 text-gray-700 border-gray-200">
              Welcome to StockAI
            </span>
          </div>

          <button
            type="button"
            onClick={closeWelcome}
            className="text-[11px] font-mono text-gray-400 hover:text-gray-700 px-2 py-0.5 rounded hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            esc
          </button>
        </div>

        {/* Title & Description */}
        <div className="mt-4">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
            Financial analytics & AI price prediction platform
          </h3>
          <p className="mt-1.5 text-xs text-gray-600 leading-relaxed">
            StockAI streams real-time market quotes directly from the Ho Chi Minh City Stock Exchange and provides next-session machine learning forecasts, in-depth company fundamentals, and corporate filings.
          </p>
        </div>

        {/* 3 Core Highlights */}
        <div className="mt-4 space-y-2">
          <div className="rounded-lg border border-gray-200/80 bg-gray-50/70 p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-800">1. Real-time market feed & trading</span>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-cyan-50 text-cyan-800 border border-cyan-200/60">
                WebSocket
              </span>
            </div>
            <p className="text-[11px] text-gray-600 mt-1 leading-normal">
              Low-latency quote feeds, matched order books, top movers, and live HOSE trading session indicators.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200/80 bg-gray-50/70 p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-800">2. 7-dimension stock analysis</span>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-cyan-50 text-cyan-800 border border-cyan-200/60">
                Deep Dive
              </span>
            </div>
            <p className="text-[11px] text-gray-600 mt-1 leading-normal">
              Comprehensive breakdown for each stock: Trading, History, Statistics, Financials, Company, AI Predict, and News.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200/80 bg-gray-50/70 p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-800">3. Market breadth & AI accuracy audit</span>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-cyan-50 text-cyan-800 border border-cyan-200/60">
                Backtest
              </span>
            </div>
            <p className="text-[11px] text-gray-600 mt-1 leading-normal">
              Macro consensus tracking and verified empirical hit rates of AI predictions across past market sessions.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 pt-3 border-t border-gray-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-2">
          <button
            type="button"
            onClick={closeWelcome}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-md border text-[11px] font-medium bg-white/90 text-gray-700 border-gray-300 hover:bg-gray-50 hover:text-gray-900 shadow-xs h-7 px-3 transition-colors cursor-pointer"
          >
            Explore on my own
          </button>

          <button
            type="button"
            onClick={startTour}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-md border text-[11px] font-semibold bg-cyan-700 text-white border-cyan-800 hover:bg-cyan-800 shadow-xs h-7 px-3.5 transition-all cursor-pointer"
          >
            Start interactive tour &rarr;
          </button>
        </div>
      </div>
    </div>
  )
}
