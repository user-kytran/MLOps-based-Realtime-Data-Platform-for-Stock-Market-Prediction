"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, TrendingUp, TrendingDown, Eye, MessageCircle } from "lucide-react"

const recentActivities = [
  {
    id: 1,
    type: "price_alert",
    title: "Cảnh báo giá VNM",
    description: "VNM đã vượt mức 82,000 VND",
    time: "5 phút trước",
    icon: TrendingUp,
    color: "text-success",
  },
  {
    id: 2,
    type: "watchlist",
    title: "Thêm vào danh sách theo dõi",
    description: "Đã thêm HPG vào watchlist",
    time: "2 giờ trước",
    icon: Eye,
    color: "text-primary",
  },
  {
    id: 3,
    type: "ai_chat",
    title: "Tư vấn AI",
    description: "Đã hỏi về xu hướng VIC tuần tới",
    time: "4 giờ trước",
    icon: MessageCircle,
    color: "text-primary",
  },
  {
    id: 4,
    type: "price_alert",
    title: "Cảnh báo giá HPG",
    description: "HPG giảm xuống dưới 25,000 VND",
    time: "1 ngày trước",
    icon: TrendingDown,
    color: "text-destructive",
  },
  {
    id: 5,
    type: "news",
    title: "Tin tức quan tâm",
    description: "Vinamilk công bố kết quả Q4",
    time: "1 ngày trước",
    icon: Clock,
    color: "text-muted-foreground",
  },
]

export function RecentActivity() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Hoạt động gần đây
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentActivities.map((activity) => {
            const Icon = activity.icon
            return (
              <div
                key={activity.id}
                className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className={`p-2 rounded-full bg-muted ${activity.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-sm">{activity.title}</h4>
                    <Badge variant="outline" className="text-xs">
                      {activity.type === "price_alert"
                        ? "Cảnh báo"
                        : activity.type === "watchlist"
                          ? "Watchlist"
                          : activity.type === "ai_chat"
                            ? "AI Chat"
                            : "Tin tức"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{activity.description}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="text-center mt-6">
          <button className="text-primary hover:text-primary/80 font-medium transition-colors text-sm">
            Xem tất cả hoạt động →
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
