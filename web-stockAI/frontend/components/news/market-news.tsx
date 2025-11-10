"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, ExternalLink, Newspaper } from "lucide-react"
import { useState, useEffect } from "react"
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

export function MarketNews() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNews = async () => {
    try {
      const response = await fetch(`${API_URL}/news/news_new`)
      const data = await response.json()
      setNews(data)
    } catch (error) {
      console.error("Lỗi khi tải tin tức:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNews()
    
    // Cập nhật mỗi tiếng (3600000ms)
    const interval = setInterval(fetchNews, 3600000)
    
    return () => clearInterval(interval)
  }, [])
  return (
    <Card className="bg-zinc-950 text-white">
      <CardHeader>
        <CardTitle className="flex items-center justify-center gap-2 text-2xl font-bold text-white">
          <Newspaper className="h-6 w-6 text-sky-700" />
          MARKET NEWS
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : (
          <div className="flex flex-col gap-4">
            {news.map((item) => (
              <div key={item.article_id} className="group cursor-pointer">
                <div className="p-4 rounded-lg border border-gray-700 bg-gray-800 hover:border-sky-400/50 transition-all hover:shadow-md hover:bg-gray-700">
                  <div className="flex items-start justify-between mb-3">
                    <Badge variant="outline" className="text-xs bg-sky-950 text-sky-400 border-sky-700">
                      {item.stock_code}
                    </Badge>
                    <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-sky-400 transition-colors" />
                  </div>

                  <h3 className="font-semibold text-white mb-2 line-clamp-2 group-hover:text-sky-600 transition-colors">
                    {item.title}
                  </h3>

                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(item.date).toLocaleString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-6">
          <button className="text-zinc-400 hover:text-gray-600 font-medium transition-colors">
            <a href="news" target="_blank" rel="noopener noreferrer">
              View all news →
            </a>
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
