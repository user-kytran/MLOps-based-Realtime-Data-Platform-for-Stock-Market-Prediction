"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MessageCircle, TrendingUp, BarChart3, BookOpen, Lightbulb, Clock, Star } from "lucide-react"

const chatCategories = [
  {
    id: "analysis",
    name: "Phân tích cổ phiếu",
    icon: BarChart3,
    count: 156,
    examples: ["Dự đoán giá VNM", "Phân tích kỹ thuật VIC", "So sánh HPG vs HSG"],
  },
  {
    id: "market",
    name: "Thị trường",
    icon: TrendingUp,
    count: 89,
    examples: ["Xu hướng VN-Index", "Tác động lãi suất Fed", "Phân tích ngành"],
  },
  {
    id: "education",
    name: "Giáo dục",
    icon: BookOpen,
    count: 234,
    examples: ["Cách đọc biểu đồ", "Giải thích P/E ratio", "Chiến lược đầu tư"],
  },
  {
    id: "tips",
    name: "Mẹo đầu tư",
    icon: Lightbulb,
    count: 67,
    examples: ["Quản lý rủi ro", "Thời điểm mua bán", "Đa dạng hóa danh mục"],
  },
]

const recentChats = [
  { id: 1, title: "Phân tích VNM tuần này", time: "2 giờ trước", messages: 12 },
  { id: 2, title: "So sánh cổ phiếu ngân hàng", time: "1 ngày trước", messages: 8 },
  { id: 3, title: "Dự đoán VN-Index tháng 3", time: "2 ngày trước", messages: 15 },
  { id: 4, title: "Hướng dẫn đọc biểu đồ nến", time: "3 ngày trước", messages: 6 },
]

const popularQuestions = [
  "Cách tính P/E ratio?",
  "Khi nào nên bán cổ phiếu?",
  "Phân tích RSI là gì?",
  "Đầu tư dài hạn hay ngắn hạn?",
  "Cách đọc báo cáo tài chính?",
]

export function ChatSidebar() {
  return (
    <div className="space-y-6">
      {/* Chat Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Chủ đề
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {chatCategories.map((category) => {
            const Icon = category.icon
            return (
              <div key={category.id} className="group cursor-pointer">
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-primary" />
                    <div>
                      <div className="font-medium text-sm">{category.name}</div>
                      <div className="text-xs text-muted-foreground">{category.count} câu hỏi</div>
                    </div>
                  </div>
                </div>

                {/* Examples */}
                <div className="ml-7 mt-2 space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {category.examples.map((example, index) => (
                    <div key={index} className="text-xs text-muted-foreground hover:text-primary cursor-pointer">
                      • {example}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Recent Chats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Cuộc trò chuyện gần đây
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentChats.map((chat) => (
            <div key={chat.id} className="p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group">
              <div className="font-medium text-sm mb-1 line-clamp-1 group-hover:text-primary">{chat.title}</div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{chat.time}</span>
                <Badge variant="secondary" className="text-xs">
                  {chat.messages} tin nhắn
                </Badge>
              </div>
            </div>
          ))}

          <Button variant="ghost" className="w-full text-sm">
            Xem tất cả
          </Button>
        </CardContent>
      </Card>

      {/* Popular Questions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            Câu hỏi phổ biến
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {popularQuestions.map((question, index) => (
            <div
              key={index}
              className="text-sm text-muted-foreground hover:text-primary cursor-pointer p-2 rounded hover:bg-muted/50 transition-colors"
            >
              {question}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* AI Features */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
              <MessageCircle className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="font-medium text-sm">AI Tư vấn Pro</span>
          </div>
          <div className="text-xs text-muted-foreground mb-3">
            Nâng cấp để nhận phân tích chuyên sâu và dự đoán chính xác hơn
          </div>
          <Button size="sm" className="w-full">
            Nâng cấp ngay
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
