"use client"

import { useState, useEffect } from "react"
import { API_URL } from "@/lib/api"
import { cachedFetch } from "@/lib/apiCache"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, X } from "lucide-react"

const timeFilters = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
]

interface Sector {
  id: string
  label: string
  count: number
}

interface Filters {
  sector: string
  timeFilter: string
  searchQuery: string
  fromDate: string
  toDate: string
}

interface NewsFiltersProps {
  filters: Filters
  setFilters: (filters: Filters) => void
}

export function NewsFilters({ filters, setFilters }: NewsFiltersProps) {
  const [sectors, setSectors] = useState<Sector[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch sectors on component mount
  useEffect(() => {
    const fetchSectors = async () => {
      try {
        const data = await cachedFetch(`${API_URL}/news/sectors`, 60 * 60 * 1000)
        const list = Array.isArray(data) ? data : []
        setSectors(list)
      } catch {
        // Silent on sector fetch error
      } finally {
        setLoading(false)
      }
    }
    
    fetchSectors()
  }, [])

  const handleFromDateChange = (value: string) => {
    setFilters({
      ...filters,
      fromDate: value,
      toDate: filters.toDate && value && filters.toDate < value ? "" : filters.toDate
    })
  }

  const handleToDateChange = (value: string) => {
    if (!filters.fromDate || !value || value >= filters.fromDate) {
      setFilters({ ...filters, toDate: value })
    }
  }

  const hasActiveFilters =
    filters.sector !== "all" ||
    (filters.timeFilter && filters.timeFilter !== "today") ||
    !!filters.fromDate ||
    !!filters.toDate ||
    !!filters.searchQuery.trim()

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="relative max-w-xl mx-auto">
        <Search className="absolute left-3 top-1/2 h-4 w-4 transform -translate-y-1/2 text-black" />
        <Input
          type="text"
          placeholder="Search by stock symbol or company name..."
          value={filters.searchQuery}
          onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
          className="h-8 pl-9 pr-3 py-1.5 text-sm rounded-lg border-2 border-gray-600 hover:border-gray-500 text-black bg-white"
        />
      </div>

      {/* Filters Section */}
      <div className="space-y-3">
        {/* Sector Filters - Full Width */}
        <div>
          <h3 className="mb-2 text-xs font-semibold text-gray-700">
            Stock Sectors
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {loading ? (
              <div className="text-xs text-gray-500">Loading sectors...</div>
            ) : (
              sectors.map((sector) => (
                <Button
                  key={sector.id}
                  variant={filters.sector === sector.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilters({ ...filters, sector: sector.id })}
                  className={`h-7 px-2.5 text-[11px] font-medium ${filters.sector === sector.id ? 'bg-cyan-600 text-white hover:bg-cyan-700' : 'bg-white/90 text-gray-700 border-gray-300 hover:bg-gray-50 hover:text-gray-900'}`}
                >
                  {sector.label}
                  <Badge variant="secondary" className="ml-1 h-3.5 px-1 py-0 text-[9px] bg-gray-200 text-gray-700">
                    {sector.count}
                  </Badge>
                </Button>
              ))
            )}
          </div>
        </div>

        {/* Time and Date Range - Side by Side */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 items-end">
          {/* Time Filters */}
          <div>
            <h3 className="mb-1.5 text-xs font-semibold text-gray-700">
              Time
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {timeFilters.map((filter) => (
                <Button
                  key={filter.id}
                  variant={filters.timeFilter === filter.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilters({ ...filters, timeFilter: filter.id })}
                  className={`h-7 px-2.5 text-[11px] font-medium ${filters.timeFilter === filter.id ? 'bg-cyan-600 text-white hover:bg-cyan-700' : 'bg-white/90 text-gray-700 border-gray-300 hover:bg-gray-50 hover:text-gray-900'}`}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Date Range Filters - Streamlined Inline Range Control without YYYY-MM-DD placeholder */}
          <div>
            <h3 className="mb-1.5 text-xs font-semibold text-gray-700">
              Date Range
            </h3>
            <div className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white/95 px-2.5 h-7 shadow-xs">
              <span className="text-[11px] font-medium text-gray-500">From</span>
              <input
                type="date"
                value={filters.fromDate}
                onChange={(e) => handleFromDateChange(e.target.value)}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker?.()
                  } catch {}
                }}
                className={`bg-transparent text-xs font-mono text-gray-800 focus:outline-none cursor-pointer ${
                  !filters.fromDate ? "[&::-webkit-datetime-edit]:hidden w-5" : "w-auto"
                }`}
              />
              <span className="text-gray-400 text-xs font-mono px-0.5">→</span>
              <span className="text-[11px] font-medium text-gray-500">To</span>
              <input
                type="date"
                value={filters.toDate}
                onChange={(e) => handleToDateChange(e.target.value)}
                min={filters.fromDate}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker?.()
                  } catch {}
                }}
                className={`bg-transparent text-xs font-mono text-gray-800 focus:outline-none cursor-pointer ${
                  !filters.toDate ? "[&::-webkit-datetime-edit]:hidden w-5" : "w-auto"
                }`}
              />
              {(filters.fromDate || filters.toDate) && (
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, fromDate: "", toDate: "" })}
                  className="text-gray-400 hover:text-gray-700 p-0.5 ml-1 cursor-pointer"
                  title="Clear date range"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Active Filters Summary - Clean Dismissible Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-xs font-medium text-gray-500">Active filters:</span>

          {filters.sector !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-800">
              {sectors.find((s) => s.id === filters.sector)?.label || filters.sector}
              <button
                type="button"
                onClick={() => setFilters({ ...filters, sector: "all" })}
                className="hover:text-cyan-950 cursor-pointer p-0.5"
                title="Remove sector filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {filters.timeFilter && filters.timeFilter !== "today" && (
            <span className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-800">
              {timeFilters.find((t) => t.id === filters.timeFilter)?.label || filters.timeFilter}
              <button
                type="button"
                onClick={() => setFilters({ ...filters, timeFilter: "today" })}
                className="hover:text-cyan-950 cursor-pointer p-0.5"
                title="Reset time filter to Today"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {filters.fromDate && (
            <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
              From: {filters.fromDate}
              <button
                type="button"
                onClick={() => setFilters({ ...filters, fromDate: "" })}
                className="hover:text-gray-900 cursor-pointer p-0.5"
                title="Remove start date"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {filters.toDate && (
            <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
              To: {filters.toDate}
              <button
                type="button"
                onClick={() => setFilters({ ...filters, toDate: "" })}
                className="hover:text-gray-900 cursor-pointer p-0.5"
                title="Remove end date"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {filters.searchQuery.trim() && (
            <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
              Query: "{filters.searchQuery}"
              <button
                type="button"
                onClick={() => setFilters({ ...filters, searchQuery: "" })}
                className="hover:text-gray-900 cursor-pointer p-0.5"
                title="Clear search query"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          <button
            type="button"
            className="text-xs font-medium text-gray-500 hover:text-gray-800 hover:underline cursor-pointer pl-1"
            onClick={() => {
              setFilters({
                sector: "all",
                timeFilter: "today",
                fromDate: "",
                toDate: "",
                searchQuery: ""
              })
            }}
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
