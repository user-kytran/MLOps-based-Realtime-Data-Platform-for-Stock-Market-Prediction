"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, ExternalLink, Newspaper } from "lucide-react"

// Mock news data specific to stock
const getRelatedNews = (symbol: string) => {
  const newsData = {
    VNM: [
      {
        id: 1,
        title: "Vinamilk báo cáo doanh thu quý 4 tăng trưởng mạnh",
        summary: "Công ty ghi nhận mức tăng trưởng 12% so với cùng kỳ năm trước...",
        time: "2 giờ trước",
        source: "VnExpress",
        category: "Kết quả kinh doanh",
      },
      {
        id: 2,
        title: "VNM mở rộng thị trường xuất khẩu sang Trung Đông",
        summary: "Chiến lược mở rộng quốc tế của Vinamilk tiếp tục được triển khai...",
        time: "1 ngày trước",
        source: "CafeF",
        category: "Mở rộng kinh doanh",
      },
      {
        id: 3,
        title: "Phân tích: VNM vẫn là lựa chọn hàng đầu trong ngành sữa",
        summary: "Các chuyên gia đánh giá tích cực về triển vọng của cổ phiếu VNM...",
        time: "2 ngày trước",
        source: "Đầu tư",
        category: "Phân tích",
      },
      {
        id: 4,
        title: "Vinamilk công bố kế hoạch đầu tư nhà máy mới tại miền Bắc",
        summary: "Dự án trị giá 500 tỷ đồng dự kiến hoàn thành trong năm 2025...",
        time: "3 ngày trước",
        source: "Thanh Niên",
        category: "Đầu tư",
      },
    ],
  }
  return newsData[symbol as keyof typeof newsData] || newsData.VNM
}

interface RelatedNewsProps {
  symbol: string
}

export function RelatedNews({ symbol }: RelatedNewsProps) {
  const news = getRelatedNews(symbol)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-primary" />
          Tin tức về {symbol}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {news.map((article) => (
            <div
              key={article.id}
              className="group cursor-pointer p-4 rounded-lg border border-border hover:border-primary/50 transition-all hover:shadow-md"
            >
              <div className="flex items-start justify-between mb-2">
                <Badge variant="outline" className="text-xs">
                  {article.category}
                </Badge>
                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>

              <h4 className="font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                {article.title}
              </h4>

              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{article.summary}</p>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {article.time}
                </span>
                <span>{article.source}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-6">
          <button className="text-primary hover:text-primary/80 font-medium transition-colors">
            Xem thêm tin tức về {symbol} →
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
