"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Icons } from "@/components/icons"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Clock, Play, Square } from "lucide-react"

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [mounted, setMounted] = useState(false)
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

  // Check if market is open (9:00 AM - 3:00 PM, Monday-Friday, Vietnam time)
  const isMarketOpen = () => {
    const now = currentTime
    const day = now.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const hour = now.getHours()
    const minute = now.getMinutes()
    const currentMinutes = hour * 60 + minute
    
    // Market hours: 9:30 AM - 3:00 PM (540 - 900 minutes)
    const marketOpenMinutes = 9 * 60 + 30 // 9:30 AM
    const marketCloseMinutes = 15 * 60 // 3:00 PM
    
    return day >= 1 && day <= 5 && currentMinutes >= marketOpenMinutes && currentMinutes < marketCloseMinutes
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh'
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('vi-VN', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh'
    })
  }

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="relative shrink-0">
              <Image 
                src="/logo.png" 
                alt="StockAI" 
                width={48} 
                height={48} 
                priority
                className="rounded-lg shadow-sm group-hover:shadow-md transition-shadow duration-200" 
              />
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-gray-900 group-hover:text-cyan-600 transition-colors duration-200">
                StockAI
              </span>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Finance
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex px-70 mx-auto flex-1 space-x-2">
            <Link
              href="/"
              className={`relative px-4 py-2 rounded-lg font-semibold text-[17px] transition-all duration-200 ${
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
              className={`relative px-4 py-2 rounded-lg font-semibold text-[17px] transition-all duration-200 ${
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
              className={`relative px-4 py-2 rounded-lg font-semibold text-[17px] transition-all duration-200 ${
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
              className={`relative px-4 py-2 rounded-lg font-semibold text-[17px] transition-all duration-200 ${
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

          {/* Market Status */}
          <div className="hidden lg:flex items-center space-x-6">
            {/* Market Status */}
            <div className="flex items-center space-x-3">
              {mounted ? (
                isMarketOpen() ? (
                  <div className="flex items-center space-x-2 bg-green-100 px-3 py-1.5 rounded-full">
                    <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-bold text-green-800">MỞ</span>
                    <Play className="w-4 h-4 text-green-700" />
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 bg-red-100 px-3 py-1.5 rounded-full">
                    <div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>
                    <span className="text-sm font-bold text-red-800">ĐÓNG</span>
                    <Square className="w-4 h-4 text-red-700" />
                  </div>
                )
              ) : (
                <div className="flex items-center space-x-2 bg-gray-100 px-3 py-1.5 rounded-full">
                  <div className="w-2.5 h-2.5 bg-gray-400 rounded-full"></div>
                  <span className="text-sm font-bold text-gray-700">—</span>
                </div>
              )}
            </div>
            
            {/* Divider */}
            <div className="w-px h-8 bg-gray-300"></div>
            
            {/* Time */}
            <div className="flex items-center space-x-3">
              <Clock className="w-5 h-5 text-gray-600" />
              <div className="text-right">
                <div className="text-lg font-mono font-bold text-gray-900">
                  {mounted ? formatTime(currentTime) : "--:--:--"}
                </div>
                <div className="text-xs text-gray-500 font-medium">
                  {mounted ? formatDate(currentTime) : "--/--"}
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors duration-200"
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

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200/50 bg-white/95 backdrop-blur-md">
            {/* Mobile Market Status */}
            <div className="px-4 py-4 mb-4 mx-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {mounted ? (
                    isMarketOpen() ? (
                      <div className="flex items-center space-x-2 bg-green-100 px-3 py-2 rounded-full">
                        <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-bold text-green-800">MỞ</span>
                        <Play className="w-4 h-4 text-green-700" />
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 bg-red-100 px-3 py-2 rounded-full">
                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>
                        <span className="text-sm font-bold text-red-800">ĐÓNG</span>
                        <Square className="w-4 h-4 text-red-700" />
                      </div>
                    )
                  ) : (
                    <div className="flex items-center space-x-2 bg-gray-100 px-3 py-2 rounded-full">
                      <div className="w-2.5 h-2.5 bg-gray-400 rounded-full"></div>
                      <span className="text-sm font-bold text-gray-700">—</span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-lg font-mono font-bold text-gray-900">
                    {mounted ? formatTime(currentTime) : "--:--:--"}
                  </div>
                  <div className="text-xs text-gray-500 font-medium">
                    {mounted ? formatDate(currentTime) : "--/--"}
                  </div>
                </div>
              </div>
            </div>
            
            <nav className="flex flex-col space-y-2">
              <Link
                href="/"
                onClick={() => setIsMenuOpen(false)}
                className={`px-4 py-3 rounded-lg font-semibold text-sm transition-all duration-200 ${
                  isActive("/") 
                    ? "text-cyan-600 bg-cyan-50" 
                    : "text-gray-700 hover:text-cyan-600 hover:bg-gray-50"
                }`}
              >
                Home
              </Link>
              <Link
                href="/stocks"
                onClick={() => setIsMenuOpen(false)}
                className={`px-4 py-3 rounded-lg font-semibold text-sm transition-all duration-200 ${
                  isActive("/stocks") 
                    ? "text-cyan-600 bg-cyan-50" 
                    : "text-gray-700 hover:text-cyan-600 hover:bg-gray-50"
                }`}
              >
                Stocks
              </Link>
              <Link
                href="/news"
                onClick={() => setIsMenuOpen(false)}
                className={`px-4 py-3 rounded-lg font-semibold text-sm transition-all duration-200 ${
                  isActive("/news") 
                    ? "text-cyan-600 bg-cyan-50" 
                    : "text-gray-700 hover:text-cyan-600 hover:bg-gray-50"
                }`}
              >
                News
              </Link>
              <Link
                href="/analysis"
                onClick={() => setIsMenuOpen(false)}
                className={`px-4 py-3 rounded-lg font-semibold text-sm transition-all duration-200 ${
                  isActive("/analysis") 
                    ? "text-cyan-600 bg-cyan-50" 
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