"use client"

import { useState, useEffect } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { getApiUrl } from "@/lib/config"
import { isValidStockSymbol } from "@/constants/stocks"

type SearchBarProps = {
  fullWidth?: boolean
  noMargin?: boolean
}

export function SearchBar({ fullWidth = false, noMargin = false }: SearchBarProps) {
  const [query, setQuery] = useState("")
  const [symbols, setSymbols] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string>("")
  const router = useRouter()

  const handleSearch = () => {
    if (query.trim()) {
      const symbol = query.trim().toUpperCase()
      
      if (!isValidStockSymbol(symbol)) {
        setError("Không có dữ liệu cho mã này")
        return
      }
      
      if (!symbols.size) {
        router.push(`/stock/${symbol}`)
        return
      }
      if (symbols.has(symbol)) {
        setError("")
        router.push(`/stock/${symbol}`)
      } else {
        setError("Mã không tồn tại")
      }
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const clearSearch = () => {
    setQuery("")
    setError("")
  }

  useEffect(() => {
    fetch(`${getApiUrl()}/stocks/get_reference`)
      .then(res => res.json())
      .then((data) => {
        const set = new Set<string>()
        data.forEach((item: any) => set.add(String(item.symbol).toUpperCase()))
        setSymbols(set)
      })
      .catch(() => {})
  }, [])

  return (
    <div className={fullWidth ? "w-full" : "max-w-2xl mx-auto"}>
      <div className={noMargin ? "relative" : "relative mb-2"}>
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-black" />
        <Input
          type="text"
          placeholder="Search by stock symbol or company name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyPress}
          className={`pl-12 pr-20 py-6 text-lg rounded-xl border-2 ${error ? "border-red-500" : "border-gray-600 hover:border-gray-500"} text-black bg-white`}
        />
      </div>
      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}
    </div>
  )
}
