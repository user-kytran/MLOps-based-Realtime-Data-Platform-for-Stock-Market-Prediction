"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, ExternalLink, Newspaper, Filter, FileText } from "lucide-react"
import { API_URL } from "@/lib/api"

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

interface StockNewsProps {
  symbol: string
}

export function StockNews({ symbol }: StockNewsProps) {
  const [timeFilter, setTimeFilter] = useState<"all" | "today" | "week" | "month" | "custom">("all")
  const [newsData, setNewsData] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  useEffect(() => {
    setLoading(true)
    fetch(`${API_URL}/news/news_by_symbol?symbol=${symbol}`)
      .then(res => res.json())
      .then((data) => {
        if (data && Array.isArray(data)) {
          const sortedData = data.sort((a: NewsItem, b: NewsItem) => {
            return new Date(b.date).getTime() - new Date(a.date).getTime()
          })
          setNewsData(sortedData)
        }
        setLoading(false)
      })
      .catch(err => {
        setLoading(false)
      })
  }, [symbol])

  const filterNewsByTime = (news: NewsItem[]) => {
    const now = new Date()
    
    return news.filter(item => {
      const newsDate = new Date(item.date)
      
      switch (timeFilter) {
        case "today": {
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          return newsDate >= today
        }
        case "week": {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          return newsDate >= weekAgo
        }
        case "month": {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          return newsDate >= monthAgo
        }
        case "custom": {
          if (!startDate && !endDate) return true
          
          const start = startDate ? new Date(startDate) : null
          const end = endDate ? new Date(endDate) : null
          
          if (start && end) {
            end.setHours(23, 59, 59, 999)
            return newsDate >= start && newsDate <= end
          } else if (start) {
            return newsDate >= start
          } else if (end) {
            end.setHours(23, 59, 59, 999)
            return newsDate <= end
          }
          return true
        }
        default:
          return true
      }
    })
  }

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      
      if (diffHours < 1) {
        return "Just now"
      } else if (diffHours < 24) {
        return `${diffHours} hours ago`
      } else if (diffDays < 7) {
        return `${diffDays} days ago`
      } else {
        return date.toLocaleDateString("vi-VN")
      }
    } catch {
      return dateStr
    }
  }

  const filteredNews = filterNewsByTime(newsData)

  return (
    <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Newspaper className="h-5 w-5 text-blue-600" />
              News about {symbol}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <div className="flex gap-1 flex-wrap">
                <Button
                  size="sm"
                  variant={timeFilter === "all" ? "default" : "outline"}
                  onClick={() => setTimeFilter("all")}
                  className="text-xs"
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant={timeFilter === "today" ? "default" : "outline"}
                  onClick={() => setTimeFilter("today")}
                  className="text-xs"
                >
                  Today
                </Button>
                <Button
                  size="sm"
                  variant={timeFilter === "week" ? "default" : "outline"}
                  onClick={() => setTimeFilter("week")}
                  className="text-xs"
                >
                  Week
                </Button>
                <Button
                  size="sm"
                  variant={timeFilter === "month" ? "default" : "outline"}
                  onClick={() => setTimeFilter("month")}
                  className="text-xs"
                >
                  Month
                </Button>
                <Button
                  size="sm"
                  variant={timeFilter === "custom" ? "default" : "outline"}
                  onClick={() => setTimeFilter("custom")}
                  className="text-xs"
                >
                  Custom
                </Button>
              </div>
            </div>
          </div>
          
          {timeFilter === "custom" && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 flex-1">
                <label className="text-sm text-gray-500 whitespace-nowrap">From:</label>
                <input
                  type="date"
                  value={startDate}
                  max={endDate || undefined}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2 flex-1">
                <label className="text-sm text-gray-500 whitespace-nowrap">To:</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {(startDate || endDate) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setStartDate("")
                    setEndDate("")
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : filteredNews.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No news in this time period</div>
        ) : (
          <div className="space-y-4">
            {filteredNews.map((item) => (
              <Card key={item.article_id} className="overflow-hidden hover:shadow-lg transition-all bg-white border-gray-200 hover:border-gray-300">
                <CardContent className="px-10 py-4 h-20 flex flex-col justify-center">
                  <div className="space-y-1.5">
                    {/* Header: Stock Code */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs h-5 px-2 bg-cyan-100 text-cyan-800 border-cyan-300 font-semibold">
                        {item.stock_code}
                      </Badge>
                    </div>
                    
                    {/* Title */}
                    <h2 
                      className="px-5 my-[20px] font-extrabold text-gray-900 text-[17px] line-clamp-1 hover:text-cyan-600 transition-colors cursor-pointer"
                      onClick={() => window.open(item.is_pdf && item.pdf_link ? item.pdf_link : item.link, '_blank')}
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
                            onClick={() => window.open(item.pdf_link!, '_blank')}
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
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}