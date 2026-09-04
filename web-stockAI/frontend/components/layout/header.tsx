"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Clock } from "lucide-react"

import { useMarketStatus } from "@/hooks/useMarketStatus"
import { useAuth } from "@/lib/authContext"
import { GoogleSignInButton, UserNav } from "@/components/auth"

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [mounted, setMounted] = useState(false)
  const { status: marketStatus } = useMarketStatus()
  const { user } = useAuth()
  const pathname = usePathname()

  const isActive = (path: string) => pathname === path

  // Ensure component is mounted before showing time
  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh'
    })
  }

  const formatDate = (date: Date) => {
    const weekday = date.toLocaleDateString('en-US', {
      weekday: 'short',
      timeZone: 'Asia/Ho_Chi_Minh'
    })
    const day = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh'
    })
    const month = date.toLocaleDateString('en-GB', {
      month: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh'
    })
    return `${weekday}, ${day}/${month}`
  }

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-12">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="relative shrink-0">
              <Image
                src="/logo.png"
                alt="StockAI"
                width={36}
                height={36}
                priority
                className="rounded-lg shadow-sm group-hover:shadow-md transition-shadow duration-200"
              />
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-gray-900 group-hover:text-cyan-600 transition-colors duration-200">
                StockAI
              </span>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Finance
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex mx-auto flex-1 justify-center space-x-1">
            <Link
              href="/"
              className={`relative px-3 py-1.5 rounded-md font-semibold text-sm transition-all duration-200 ${
                isActive("/")
                  ? "text-cyan-700 bg-cyan-50 shadow-sm"
                  : "text-gray-700 hover:text-cyan-600 hover:bg-gray-50"
              }`}
            >
              Home
              {isActive("/") && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-cyan-600 rounded-full"></div>
              )}
            </Link>
            <Link
              href="/stocks"
              className={`relative px-3 py-1.5 rounded-md font-semibold text-sm transition-all duration-200 ${
                isActive("/stocks")
                  ? "text-cyan-700 bg-cyan-50 shadow-sm"
                  : "text-gray-700 hover:text-cyan-600 hover:bg-gray-50"
              }`}
            >
              Stocks
              {isActive("/stocks") && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-cyan-600 rounded-full"></div>
              )}
            </Link>
            <Link
              href="/news"
              className={`relative px-3 py-1.5 rounded-md font-semibold text-sm transition-all duration-200 ${
                isActive("/news")
                  ? "text-cyan-700 bg-cyan-50 shadow-sm"
                  : "text-gray-700 hover:text-cyan-600 hover:bg-gray-50"
              }`}
            >
              News
              {isActive("/news") && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-cyan-600 rounded-full"></div>
              )}
            </Link>
            <Link
              href="/analysis"
              className={`relative px-3 py-1.5 rounded-md font-semibold text-sm transition-all duration-200 ${
                isActive("/analysis")
                  ? "text-cyan-700 bg-cyan-50 shadow-sm"
                  : "text-gray-700 hover:text-cyan-600 hover:bg-gray-50"
              }`}
            >
              Analysis
              {isActive("/analysis") && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-cyan-600 rounded-full"></div>
              )}
            </Link>
          </nav>

          {/* Desktop Right: Market Status, Time & User Profile */}
          <div className="hidden md:flex items-center space-x-3">
            {/* Market Status (Shown on lg+) - Clean Professional Financial Pill */}
            <div className="hidden lg:flex items-center space-x-3">
              {mounted && marketStatus ? (
                marketStatus.is_open ? (
                  <div
                    className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50/80 px-2.5 py-1 text-xs transition-colors cursor-default"
                    title={marketStatus.label || "HOSE: Market Open"}
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600"></span>
                    </span>
                    <span className="text-slate-600 font-medium">HOSE</span>
                    <span className="font-bold text-green-700">
                      {marketStatus.status_code === "ATO" ? "ATO" : marketStatus.status_code === "ATC" ? "ATC" : "OPEN"}
                    </span>
                  </div>
                ) : marketStatus.status_code === "LUNCH_BREAK" ? (
                  <div
                    className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/80 px-2.5 py-1 text-xs transition-colors cursor-default"
                    title={marketStatus.label || "HOSE: Lunch Break"}
                  >
                    <span className="h-2 w-2 rounded-full bg-amber-500 inline-block"></span>
                    <span className="text-slate-600 font-medium">HOSE</span>
                    <span className="font-bold text-amber-700">INTERMISSION</span>
                  </div>
                ) : (
                  <div
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs transition-colors cursor-default"
                    title={marketStatus.label || "HOSE: Market Closed"}
                  >
                    <span className="h-2 w-2 rounded-full bg-slate-400 inline-block"></span>
                    <span className="text-slate-600 font-medium">HOSE</span>
                    <span className="font-semibold text-slate-500">CLOSED</span>
                  </div>
                )
              ) : (
                <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs">
                  <span className="h-2 w-2 rounded-full bg-slate-300 inline-block"></span>
                  <span className="text-slate-400 font-medium">HOSE —</span>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="hidden lg:block w-px h-6 bg-gray-200"></div>

            {/* Time (Shown on lg+) */}
            <div className="hidden lg:flex items-center space-x-2">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <div className="text-right">
                <div className="text-xs font-mono font-bold text-gray-800 leading-tight">
                  {mounted ? formatTime(currentTime) : "--:--:--"}
                </div>
                <div className="text-[10px] text-gray-500 font-medium leading-tight">
                  {mounted ? formatDate(currentTime) : "--/--"}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="hidden lg:block w-px h-6 bg-gray-200"></div>

            {/* User Auth / Profile */}
            <div className="flex items-center pl-1">
              {user ? <UserNav /> : <GoogleSignInButton />}
            </div>
          </div>

          {/* Mobile Right: Auth & Menu Button */}
          <div className="flex md:hidden items-center space-x-2">
            {user ? <UserNav /> : <GoogleSignInButton size="small" />}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors duration-200"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200/50 bg-white/95 backdrop-blur-md">
            {/* Mobile Market Status */}
            <div className="px-4 py-3 mb-3 mx-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {mounted && marketStatus ? (
                    marketStatus.is_open ? (
                      <div
                        className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50/80 px-2.5 py-1 text-xs"
                        title={marketStatus.label || "HOSE: Market Open"}
                      >
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600"></span>
                        </span>
                        <span className="text-slate-600 font-medium">HOSE</span>
                        <span className="font-bold text-green-700">
                          {marketStatus.status_code === "ATO" ? "ATO" : marketStatus.status_code === "ATC" ? "ATC" : "OPEN"}
                        </span>
                      </div>
                    ) : marketStatus.status_code === "LUNCH_BREAK" ? (
                      <div
                        className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/80 px-2.5 py-1 text-xs"
                        title={marketStatus.label || "HOSE: Lunch Break"}
                      >
                        <span className="h-2 w-2 rounded-full bg-amber-500 inline-block"></span>
                        <span className="text-slate-600 font-medium">HOSE</span>
                        <span className="font-bold text-amber-700">INTERMISSION</span>
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs"
                        title={marketStatus.label || "HOSE: Market Closed"}
                      >
                        <span className="h-2 w-2 rounded-full bg-slate-400 inline-block"></span>
                        <span className="text-slate-600 font-medium">HOSE</span>
                        <span className="font-semibold text-slate-500">CLOSED</span>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs">
                      <span className="h-2 w-2 rounded-full bg-slate-300 inline-block"></span>
                      <span className="text-slate-400 font-medium">HOSE —</span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-gray-800 leading-tight">
                    {mounted ? formatTime(currentTime) : "--:--:--"}
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium leading-tight">
                    {mounted ? formatDate(currentTime) : "--/--"}
                  </div>
                </div>
              </div>
            </div>

            <nav className="flex flex-col space-y-1 px-4">
              <Link
                href="/"
                onClick={() => setIsMenuOpen(false)}
                className={`px-3 py-2 rounded-md font-semibold text-sm transition-all duration-200 ${
                  isActive("/")
                    ? "text-cyan-700 bg-cyan-50"
                    : "text-gray-700 hover:text-cyan-600 hover:bg-gray-50"
                }`}
              >
                Home
              </Link>
              <Link
                href="/stocks"
                onClick={() => setIsMenuOpen(false)}
                className={`px-3 py-2 rounded-md font-semibold text-sm transition-all duration-200 ${
                  isActive("/stocks")
                    ? "text-cyan-700 bg-cyan-50"
                    : "text-gray-700 hover:text-cyan-600 hover:bg-gray-50"
                }`}
              >
                Stocks
              </Link>
              <Link
                href="/news"
                onClick={() => setIsMenuOpen(false)}
                className={`px-3 py-2 rounded-md font-semibold text-sm transition-all duration-200 ${
                  isActive("/news")
                    ? "text-cyan-700 bg-cyan-50"
                    : "text-gray-700 hover:text-cyan-600 hover:bg-gray-50"
                }`}
              >
                News
              </Link>
              <Link
                href="/analysis"
                onClick={() => setIsMenuOpen(false)}
                className={`px-3 py-2 rounded-md font-semibold text-sm transition-all duration-200 ${
                  isActive("/analysis")
                    ? "text-cyan-700 bg-cyan-50"
                    : "text-gray-700 hover:text-cyan-600 hover:bg-gray-50"
                }`}
              >
                Analysis
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
