"use client"

import { useState, useEffect } from "react"
import { API_URL } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Filter, Calendar, Globe, Building, TrendingUp, Briefcase, DollarSign, Zap, Home, Factory } from "lucide-react"

const sectorIcons = {
  all: Globe,
  Consumer_Cyclical: Building,
  Consumer_Defensive: Briefcase,
  Basic_Materials: Factory,
  Financial_Services: DollarSign,
  Communication_Services: Zap,
  Real_Estate: Home,
  Utilities: TrendingUp,
  Industrials: Factory,
  Technology: Zap,
  Healthcare: Briefcase,
  Energy: TrendingUp
}

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
        const response = await fetch(`${API_URL}/news/sectors`)
        const data = await response.json()
        const list = Array.isArray(data) ? data : []
        setSectors(list)
      } catch (error) {
        console.error('Error fetching sectors:', error)
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

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="relative max-w-xl mx-auto">
        <Search className="absolute left-3 top-1/2 h-4 w-4 transform -translate-y-1/2 text-cyan-600" />
        <Input
          type="text"
          placeholder="Tìm kiếm tin tức..."
          value={filters.searchQuery}
          onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
          className="h-9 rounded-md border-gray-300 bg-white/95 pl-9 pr-3 py-2 text-sm text-gray-900 shadow-sm backdrop-blur-sm placeholder:text-gray-500 focus:border-cyan-500"
        />
      </div>

      {/* Filters Section */}
      <div className="space-y-3">
        {/* Sector Filters - Full Width */}
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            <Filter className="h-3.5 w-3.5 text-cyan-600" />
            Stock Sectors
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {loading ? (
              <div className="text-xs text-gray-500">Loading sectors...</div>
            ) : (
              sectors.map((sector) => {
                const Icon = sectorIcons[sector.id as keyof typeof sectorIcons] || Globe
                return (
                  <Button
                    key={sector.id}
                    variant={filters.sector === sector.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilters({ ...filters, sector: sector.id })}
                    className={`h-7 gap-1 px-2 text-[11px] ${filters.sector === sector.id ? 'bg-cyan-600 text-white hover:bg-cyan-700' : 'bg-white/90 text-gray-700 border-gray-300 hover:bg-gray-50 hover:text-gray-900'}`}
                  >
                    <Icon className="h-3 w-3" />
                    {sector.label}
                    <Badge variant="secondary" className="ml-0.5 h-3.5 px-1 py-0 text-[9px] bg-gray-200 text-gray-700">
                      {sector.count}
                    </Badge>
                  </Button>
                )
              })
            )}
          </div>
        </div>

        {/* Time and Date Range - Side by Side */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Time Filters */}
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
              <Calendar className="h-3.5 w-3.5 text-cyan-600" />
              Time
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {timeFilters.map((filter) => (
                <Button
                  key={filter.id}
                  variant={filters.timeFilter === filter.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilters({ ...filters, timeFilter: filter.id })}
                  className={`h-7 px-2 text-[11px] ${filters.timeFilter === filter.id ? 'bg-cyan-600 text-white hover:bg-cyan-700' : 'bg-white/90 text-gray-700 border-gray-300 hover:bg-gray-50 hover:text-gray-900'}`}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Date Range Filters */}
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
              <Calendar className="h-3.5 w-3.5 text-cyan-600" />
              Date Range
            </h3>
            <div className="flex flex-wrap gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-gray-600 uppercase">From Date</label>
                <Input
                  type="date"
                  value={filters.fromDate}
                  onChange={(e) => handleFromDateChange(e.target.value)}
                  className="h-7 w-auto min-w-[130px] border-gray-300 bg-white/90 text-xs text-gray-900"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-gray-600 uppercase">To Date</label>
                <Input
                  type="date"
                  value={filters.toDate}
                  onChange={(e) => handleToDateChange(e.target.value)}
                  min={filters.fromDate}
                  className="h-7 w-auto min-w-[130px] border-gray-300 bg-white/90 text-xs text-gray-900"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Filters Summary */}
      {(filters.sector !== "all" || filters.timeFilter !== "all" || filters.fromDate || filters.toDate || filters.searchQuery) && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-gray-200 bg-white/90 p-2 text-xs shadow-sm backdrop-blur-sm">
          <span className="text-xs text-gray-600">Bộ lọc đang áp dụng:</span>
          {filters.sector !== "all" && (
            <Badge variant="secondary" className="bg-cyan-100 text-[11px] text-cyan-800">{sectors.find((s) => s.id === filters.sector)?.label}</Badge>
          )}
          {filters.timeFilter !== "all" && (
            <Badge variant="secondary" className="bg-cyan-100 text-[11px] text-cyan-800">{timeFilters.find((t) => t.id === filters.timeFilter)?.label}</Badge>
          )}
          {filters.fromDate && (
            <Badge variant="secondary" className="bg-gray-100 text-[11px] text-gray-700">Từ: {filters.fromDate}</Badge>
          )}
          {filters.toDate && (
            <Badge variant="secondary" className="bg-gray-100 text-[11px] text-gray-700">Đến: {filters.toDate}</Badge>
          )}
          {filters.searchQuery && (
            <Badge variant="secondary" className="bg-gray-100 text-[11px] text-gray-700">Tìm: "{filters.searchQuery}"</Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-gray-600 hover:text-gray-800"
            onClick={() => {
              setFilters({
                sector: "all",
                timeFilter: "all",
                fromDate: "",
                toDate: "",
                searchQuery: ""
              })
            }}
          >
            Xóa tất cả
          </Button>
        </div>
      )}
    </div>
  )
}
