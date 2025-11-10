"use client"

import { useState, useEffect } from "react"
import { API_URL } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, FileText, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface NewsItem {
  stock_code: string
  article_id: string
  title: string
  date: string
  link: string
  is_pdf: boolean
  pdf_link?: string
  content: string
}

interface Filters {
  sector: string
  timeFilter: string
  searchQuery: string
  fromDate: string
  toDate: string
}

interface NewsListProps {
  filters: Filters
}

const ITEMS_PER_PAGE = 20

const SECTOR_MAPPING: Record<string, string[]> = {
  "Consumer_Cyclical": ['AAA','ADS','CSM','CTF','DAH','DPR','DRC','DSN','EVE','FRT','GDT','GIL','GVR','HAX','HTG','HTN','HVH','KMR','MCP','MSH','MWG','PNJ','SAV','SFC','ST8','STK','TCM','TCT','TDP','TMT','TTF'],
  "Consumer_Defensive": ['AAM','ABT','ACL','ANV','BAF','CLC','CMX','DBC','FMC','HSL','IDI','KDC','LAF','LIX','LSS','MCM','NAF','NSC','PAN','PHR','SAB','SBT','SMB','SVT','TSC','VHC','VNM'],
  "Basic_Materials": ['ABS','ACC','ADP','APH','BFC','BKG','BMC','C32','CSV','CTI','DCM','DGC','DHA','DHC','DPM','FCM','HAP','HHP','HII','HPG','HSG','HT1','KSB','LBM','NHH','NKG','NNC','PLP','QCG','RYG','SFG','SHI','TDC','THG','TLH','TNI','TNT','TRC','VCA','VFG','YBM'],
  "Financial_Services": ['ACB','AGR','APG','BIC','BID','BMI','BSI','BVH','CTG','CTS','DSC','DSE','EIB','EVF','FIT','FTS','HCM','HDB','LPB','MBB','MIG','MSB','NAB','OCB','ORS','SHB','SSB','SSI','STB','TCB','TCI','TPB','TVS','VCB','VCI','VDS','VIB','VIX','VND','VPB'],
  "Communication_Services": ['ADG','ICT','YEG'],
  "Real_Estate": ['AGG','ASM','BCM','CCL','CRE','DIG','DTA','DXG','DXS','FIR','HAG','HAR','HDC','HDG','HPX','HQC','ITC','KBC','KDH','KHG','KOS','LHG','NBB','NLG','PDR','SCR','SGR','SIP','SJS','SZC','SZL','TEG','UIC','VHM','VIC','VPH','VPI','VRE'],
  "Utilities": ['ASP','BTP','CNG','DRL','GSP','KHP','NT2','POW','PPC','SJD','TDG','TTA'],
  "Industrials": ['AST','BCE','BMP','BRC','BWE','CDC','CII','CLL','CRC','CTD','CTR','D2D','DC4','DHM','DPG','DVP','FCN','GEE','GEX','GMD','HAH','HCD','HHS','HHV','HID','HMC','HTI','HUB','IJC','ILB','LCG','MHC','MSN','NCT','NHA','NO1','NTL','OGC','PAC','PC1','PHC','PIT','PTB','PTC','PTL','PVP','PVT','RAL','REE','SAM','SBG','SCS','SGN','SKG','TCH','TCL','TCO','TIP','TLD','TLG','TV2','TYA','VCG','VGC','VIP','VJC','VNL','VNS','VOS','VPG','VRC','VSC','VTO','VTP'],
  "Technology": ['CMG','DGW','ELC','FPT','ITD','SGT'],
  "Healthcare": ['DBD','DBT','DCL','DMC','IMP','JVC','TNH','VMD'],
  "Energy": ['GAS','PET','PGC','PLX','PVD']
}

function getSectorByCode(stockCode: string): string {
  for (const [sector, codes] of Object.entries(SECTOR_MAPPING)) {
    if (codes.includes(stockCode)) {
      return sector
    }
  }
  return "Other"
}

export function NewsList({ filters }: NewsListProps) {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const params = new URLSearchParams()
        if (filters.sector) params.append('sector', filters.sector)
        if (filters.fromDate || filters.toDate) {
          if (filters.fromDate) params.append('from_date', filters.fromDate)
          if (filters.toDate) params.append('to_date', filters.toDate)
        } else {
          if (filters.timeFilter) params.append('time_filter', filters.timeFilter)
        }
        if (filters.searchQuery) params.append('search_query', filters.searchQuery)
        
        const url = `${API_URL}/news/news_time_filtered?${params.toString()}`
        const response = await fetch(url)
        
        if (!response.ok) {
          throw new Error('Failed to fetch news')
        }
        const data = await response.json()
        // Sắp xếp từ mới nhất đến cũ nhất
        const sortedData = data.sort((a: NewsItem, b: NewsItem) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime()
        })
        setNews(sortedData)
        setCurrentPage(1)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        setNews([])
      } finally {
        setLoading(false)
      }
    }

    fetchNews()
  }, [filters])

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      const day = date.getDate().toString().padStart(2, '0')
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const year = date.getFullYear()
      const hours = date.getHours().toString().padStart(2, '0')
      const minutes = date.getMinutes().toString().padStart(2, '0')
      return `${day}/${month}/${year} ${hours}:${minutes}`
    } catch {
      return dateStr
    }
  }

  // Pagination
  const totalPages = Math.ceil(news.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const currentNews = news.slice(startIndex, endIndex)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="text-gray-600 text-lg">Loading...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="text-red-600 text-lg">Lỗi: {error}</div>
        </div>
      </div>
    )
  }

  if (news.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="text-gray-600 text-lg">No news found</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Total count */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>Found {news.length} news</span>
        <span>Page {currentPage} / {totalPages}</span>
      </div>

      {/* News List */}
      {currentNews.map((item) => {
        const sector = getSectorByCode(item.stock_code)
        return (
          <Card key={item.article_id} className="overflow-hidden hover:shadow-lg transition-all bg-white/95 backdrop-blur-sm border-gray-200 hover:border-gray-300 shadow-sm">
            <CardContent className="px-10 py-4 h-20 flex flex-col justify-center">
              <div className="space-y-1.5">
                {/* Header: Stock Code + Sector */}
                <div className="flex items-center gap-2 flex-wrap">
                  <a href={`/stock/${item.stock_code}`} className="cursor-pointer hover:opacity-80 transition-opacity">
                    <Badge variant="outline" className="text-xs h-5 px-2 bg-cyan-100 text-cyan-800 border-cyan-300 font-semibold">
                      {item.stock_code}
                    </Badge>
                  </a>
                  <Badge variant="outline" className="text-xs h-5 px-2 bg-gray-100 text-gray-700 border-gray-300">
                    {sector}
                  </Badge>
                </div>
                
                {/* Title */}
                <h2 
                  className="px-5 my-[20px] font-extrabold text-gray-900 text-[17px] line-clamp-1 hover:text-cyan-600 transition-colors cursor-pointer"
                  onClick={() => window.open(item.link, '_blank')}
                >
                  {item.title}
                </h2>
                  
                {/* Footer */}
                <div className="flex items-center justify-between pt-0">
                  <span className="text-xs text-gray-500">{formatDate(item.date)}</span>
                  <div className="flex items-center gap-1.5">
                    {item.is_pdf && item.pdf_link && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-purple-600 hover:text-purple-700 h-6 px-2 text-[12px]"
                        onClick={() => window.open(item.pdf_link, '_blank')}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        PDF
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Trước
          </Button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              // Show first, last, current, and adjacent pages
              if (
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1)
              ) {
                return (
                  <Button
                    key={page}
                    variant={page === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className={page === currentPage 
                      ? "bg-cyan-600 text-white hover:bg-cyan-700"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                    }
                  >
                    {page}
                  </Button>
                )
              } else if (
                page === currentPage - 2 ||
                page === currentPage + 2
              ) {
                return <span key={page} className="text-gray-500">...</span>
              }
              return null
            })}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Sau
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
