"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { API_URL } from "@/lib/api"

interface NewsItem {
  stock_code: string
  article_id: string
  title: string
  date: string
}

interface SectorStats {
  sector: string
  sectorLabel: string
  total: number
  stocks: { code: string; count: number }[]
  color: string
}

const SECTOR_MAPPING: Record<string, { codes: string[]; label: string; color: string }> = {
  Consumer_Cyclical: {
    codes: ['AAA','ADS','CSM','CTF','DAH','DPR','DRC','DSN','EVE','FRT','GDT','GIL','GVR','HAX','HTG','HTN','HVH','KMR','MCP','MSH','MWG','PNJ','SAV','SFC','ST8','STK','TCM','TCT','TDP','TMT','TTF'],
    label: 'Consumer Cyclical',
    color: '#3b82f6'
  },
  Consumer_Defensive: {
    codes: ['AAM','ABT','ACL','ANV','BAF','CLC','CMX','DBC','FMC','HSL','IDI','KDC','LAF','LIX','LSS','MCM','NAF','NSC','PAN','PHR','SAB','SBT','SMB','SVT','TSC','VHC','VNM'],
    label: 'Consumer Defensive',
    color: '#8b5cf6'
  },
  Basic_Materials: {
    codes: ['ABS','ACC','ADP','APH','BFC','BKG','BMC','C32','CSV','CTI','DCM','DGC','DHA','DHC','DPM','FCM','HAP','HHP','HII','HPG','HSG','HT1','KSB','LBM','NHH','NKG','NNC','PLP','QCG','RYG','SFG','SHI','TDC','THG','TLH','TNI','TNT','TRC','VCA','VFG','YBM'],
    label: 'Basic Materials',
    color: '#78716c'
  },
  Financial_Services: {
    codes: ['ACB','AGR','APG','BIC','BID','BMI','BSI','BVH','CTG','CTS','DSC','DSE','EIB','EVF','FIT','FTS','HCM','HDB','LPB','MBB','MIG','MSB','NAB','OCB','ORS','SHB','SSB','SSI','STB','TCB','TCI','TPB','TVS','VCB','VCI','VDS','VIB','VIX','VND','VPB'],
    label: 'Financial Services',
    color: '#ec4899'
  },
  Communication_Services: {
    codes: ['ADG','ICT','YEG'],
    label: 'Communication Services',
    color: '#06b6d4'
  },
  Real_Estate: {
    codes: ['AGG','ASM','BCM','CCL','CRE','DIG','DTA','DXG','DXS','FIR','HAG','HAR','HDC','HDG','HPX','HQC','ITC','KBC','KDH','KHG','KOS','LHG','NBB','NLG','PDR','SCR','SGR','SIP','SJS','SZC','SZL','TEG','UIC','VHM','VIC','VPH','VPI','VRE'],
    label: 'Real Estate',
    color: '#10b981'
  },
  Utilities: {
    codes: ['ASP','BTP','CNG','DRL','GSP','KHP','NT2','POW','PPC','SJD','TDG','TTA'],
    label: 'Utilities',
    color: '#14b8a6'
  },
  Industrials: {
    codes: ['AST','BCE','BMP','BRC','BWE','CDC','CII','CLL','CRC','CTD','CTR','D2D','DC4','DHM','DPG','DVP','FCN','GEE','GEX','GMD','HAH','HCD','HHS','HHV','HID','HMC','HTI','HUB','IJC','ILB','LCG','MHC','MSN','NCT','NHA','NO1','NTL','OGC','PAC','PC1','PHC','PIT','PTB','PTC','PTL','PVP','PVT','RAL','REE','SAM','SBG','SCS','SGN','SKG','TCH','TCL','TCO','TIP','TLD','TLG','TV2','TYA','VCG','VGC','VIP','VJC','VNL','VNS','VOS','VPG','VRC','VSC','VTO','VTP'],
    label: 'Industrials',
    color: '#64748b'
  },
  Technology: {
    codes: ['CMG','DGW','ELC','FPT','ITD','SGT'],
    label: 'Technology',
    color: '#a855f7'
  },
  Healthcare: {
    codes: ['DBD','DBT','DCL','DMC','IMP','JVC','TNH','VMD'],
    label: 'Healthcare',
    color: '#22c55e'
  },
  Energy: {
    codes: ['GAS','PET','PGC','PLX','PVD'],
    label: 'Energy',
    color: '#f59e0b'
  }
}

interface Filters {
  sector: string
  timeFilter: string
  searchQuery: string
  fromDate: string
  toDate: string
}

export function NewsStatistics({ filters }: { filters: Filters }) {
  const [stats, setStats] = useState<SectorStats[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSector, setExpandedSector] = useState<string | null>(null)
  const [totalNews, setTotalNews] = useState(0)

  useEffect(() => {
    fetchNewsStats()
  }, [filters])

  const fetchNewsStats = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.sector) params.append('sector', filters.sector)
      if (filters.fromDate || filters.toDate) {
        if (filters.fromDate) params.append('from_date', filters.fromDate)
        if (filters.toDate) params.append('to_date', filters.toDate)
      } else if (filters.timeFilter) {
        params.append('time_filter', filters.timeFilter)
      }
      if (filters.searchQuery) params.append('search_query', filters.searchQuery)

      const response = await fetch(`${API_URL}/news/news_time_filtered?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch news')
      
      const data: NewsItem[] = await response.json()
      setTotalNews(data.length)
      
      // Tính toán thống kê
      const sectorStats: SectorStats[] = []
      
      for (const [sectorKey, sectorInfo] of Object.entries(SECTOR_MAPPING)) {
        const stockCounts: Record<string, number> = {}
        let totalCount = 0
        
        for (const item of data) {
          if (sectorInfo.codes.includes(item.stock_code)) {
            stockCounts[item.stock_code] = (stockCounts[item.stock_code] || 0) + 1
            totalCount++
          }
        }
        
        if (totalCount > 0) {
          const topStocks = Object.entries(stockCounts)
            .map(([code, count]) => ({ code, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
          
          sectorStats.push({
            sector: sectorKey,
            sectorLabel: sectorInfo.label,
            total: totalCount,
            stocks: topStocks,
            color: sectorInfo.color
          })
        }
      }
      
      // Sắp xếp theo số lượng bài báo
      sectorStats.sort((a, b) => b.total - a.total)
      setStats(sectorStats)
    } catch (error) {
      console.error('Error fetching news stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleSector = (sector: string) => {
    setExpandedSector(expandedSector === sector ? null : sector)
  }

  if (loading) {
    return (
      <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-gray-900 text-sm font-bold">
            <BarChart3 className="h-4 w-4 text-cyan-600" />
            Thống kê tin tức
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-6 text-center text-xs text-gray-600">Đang tải...</div>
        </CardContent>
      </Card>
    )
  }

  const maxCount = Math.max(...stats.map(s => s.total))

  return (
    <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-gray-900 text-sm font-bold">
          <BarChart3 className="h-4 w-4 text-cyan-600" />
          Thống kê tin tức
        </CardTitle>
        <p className="mt-1 text-xs text-gray-600">
          Tổng số: <span className="font-bold text-cyan-600">{totalNews.toLocaleString()}</span> bài báo
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Pie Chart */}
        {stats.length > 0 && (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.map(s => ({ name: s.sectorLabel, value: s.total, color: s.color }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  label={({percent }: any) => `${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                  style={{ fontSize: 11, fontWeight: 'bold' }}
                >
                  {stats.map((stat, index) => (
                    <Cell key={`cell-${index}`} fill={stat.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    color: '#374151',
                    fontSize: 12,
                    fontWeight: 'bold'
                  }}
                  wrapperStyle={{ color: '#374151' }}
                  itemStyle={{ color: '#374151' }}
                  labelStyle={{ color: '#374151' }}
                  separator=" "
                  formatter={(value: number) => [`${value} news`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Sector List */}
        <div className="space-y-2">
        {stats.map((stat) => (
          <div key={stat.sector} className="space-y-2">
            {/* Sector Header */}
            <div
              className="flex cursor-pointer items-center justify-between rounded-md bg-gray-50 p-2 transition-colors hover:bg-gray-100"
              onClick={() => toggleSector(stat.sector)}
            >
              <div className="flex flex-1 items-center gap-2">
                <div
                  className="h-6 w-1 rounded-full"
                  style={{ backgroundColor: stat.color }}
                />
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-gray-900">{stat.sectorLabel}</span>
                    <Badge
                      variant="outline"
                      className="bg-gray-200 text-[10px] text-gray-700 border-gray-300"
                    >
                      {stat.total} bài
                    </Badge>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${(stat.total / maxCount) * 100}%`,
                        backgroundColor: stat.color
                      }}
                    />
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
              >
                {expandedSector === stat.sector ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>

            {/* Top Stocks - Expanded */}
            {expandedSector === stat.sector && (
              <div className="ml-2 space-y-1.5 border-l-2 pl-3 animate-in slide-in-from-top-2" style={{ borderColor: stat.color }}>
                <div className="mb-1.5 text-[11px] font-medium text-gray-600">
                  Top cổ phiếu nhiều tin nhất:
                </div>
                {stat.stocks.map((stock, index) => (
                  <div
                    key={stock.code}
                    className="flex items-center justify-between rounded bg-gray-50 p-1.5 transition-colors hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold" style={{ backgroundColor: `${stat.color}20`, color: stat.color }}>
                        {index + 1}
                      </div>
                      <span className="font-mono text-xs font-bold text-gray-900">
                        {stock.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-[11px] text-gray-600">
                        {stock.count} bài
                      </div>
                      <div className="w-16 bg-gray-200 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${(stock.count / stat.total) * 100}%`,
                            backgroundColor: stat.color
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        </div>
      </CardContent>
    </Card>
  )
}
