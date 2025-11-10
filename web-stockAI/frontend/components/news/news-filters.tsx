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
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative max-w-2xl mx-auto">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-cyan-600 h-5 w-5" />
        <Input
          type="text"
          placeholder="Tìm kiếm tin tức..."
          value={filters.searchQuery}
          onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
          className="pl-12 pr-4 py-3 text-base rounded-lg bg-white/95 backdrop-blur-sm border-gray-300 text-gray-900 placeholder-gray-500 focus:border-cyan-500 shadow-sm"
        />
      </div>

      {/* Filters Section */}
      <div className="space-y-4">
        {/* Sector Filters - Full Width */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Filter className="h-4 w-4 text-cyan-600" />
            Stock Sectors
          </h3>
          <div className="flex flex-wrap gap-2">
            {loading ? (
              <div className="text-gray-500 text-sm">Loading sectors...</div>
            ) : (
              sectors.map((sector) => {
                const Icon = sectorIcons[sector.id as keyof typeof sectorIcons] || Globe
                return (
                  <Button
                    key={sector.id}
                    variant={filters.sector === sector.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilters({ ...filters, sector: sector.id })}
                    className={`h-8 text-xs gap-1.5 ${filters.sector === sector.id ? 'bg-cyan-600 text-white hover:bg-cyan-700' : 'bg-white/90 text-gray-700 border-gray-300 hover:bg-gray-50 hover:text-gray-900'}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {sector.label}
                    <Badge variant="secondary" className="ml-0.5 text-[10px] px-1.5 py-0 h-4 bg-gray-200 text-gray-700">
                      {sector.count}
                    </Badge>
                  </Button>
                )
              })
            )}
          </div>
        </div>

        {/* Time and Date Range - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Time Filters */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-cyan-600" />
              Time
            </h3>
            <div className="flex flex-wrap gap-2">
              {timeFilters.map((filter) => (
                <Button
                  key={filter.id}
                  variant={filters.timeFilter === filter.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilters({ ...filters, timeFilter: filter.id })}
                  className={`h-8 text-xs ${filters.timeFilter === filter.id ? 'bg-cyan-600 text-white hover:bg-cyan-700' : 'bg-white/90 text-gray-700 border-gray-300 hover:bg-gray-50 hover:text-gray-900'}`}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Date Range Filters */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-cyan-600" />
              Date Range
            </h3>
            <div className="flex gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-gray-600 uppercase">From Date</label>
                <Input
                  type="date"
                  value={filters.fromDate}
                  onChange={(e) => handleFromDateChange(e.target.value)}
                  className="h-8 text-xs w-auto min-w-[140px] bg-white/90 border-gray-300 text-gray-900"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-gray-600 uppercase">To Date</label>
                <Input
                  type="date"
                  value={filters.toDate}
                  onChange={(e) => handleToDateChange(e.target.value)}
                  min={filters.fromDate}
                  className="h-8 text-xs w-auto min-w-[140px] bg-white/90 border-gray-300 text-gray-900"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Filters Summary */}
      {(filters.sector !== "all" || filters.timeFilter !== "all" || filters.fromDate || filters.toDate || filters.searchQuery) && (
        <div className="flex items-center gap-2 p-4 bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200 shadow-sm">
          <span className="text-sm text-gray-600">Bộ lọc đang áp dụng:</span>
          {filters.sector !== "all" && (
            <Badge variant="secondary" className="bg-cyan-100 text-cyan-800">{sectors.find((s) => s.id === filters.sector)?.label}</Badge>
          )}
          {filters.timeFilter !== "all" && (
            <Badge variant="secondary" className="bg-cyan-100 text-cyan-800">{timeFilters.find((t) => t.id === filters.timeFilter)?.label}</Badge>
          )}
          {filters.fromDate && (
            <Badge variant="secondary" className="bg-gray-100 text-gray-700">Từ: {filters.fromDate}</Badge>
          )}
          {filters.toDate && (
            <Badge variant="secondary" className="bg-gray-100 text-gray-700">Đến: {filters.toDate}</Badge>
          )}
          {filters.searchQuery && (
            <Badge variant="secondary" className="bg-gray-100 text-gray-700">Tìm: "{filters.searchQuery}"</Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-600 hover:text-gray-800"
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
