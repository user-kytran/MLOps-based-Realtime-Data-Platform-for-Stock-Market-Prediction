"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Bot, User, Sparkles, HelpCircle } from "lucide-react"

interface Message {
  id: string
  type: "user" | "ai"
  content: string
  timestamp: Date
  suggestions?: string[]
}

const quickSuggestions = [
  "Xu hướng của VNM tuần tới?",
  "So sánh HPG và HSG",
  "Phân tích kỹ thuật VIC",
  "Lãi suất Fed ảnh hưởng như thế nào?",
  "Cách đọc biểu đồ nến?",
  "Dự đoán VN-Index tháng tới",
]

const mockAIResponses = {
  "xu hướng vnm": {
    content: `Dựa trên phân tích AI của chúng tôi, VNM (Vinamilk) có xu hướng **tích cực** trong tuần tới:

**Dự đoán giá:** 84,500 - 86,200 VND (+2.4% đến +4.5%)

**Phân tích kỹ thuật:**
• RSI đang ở mức 58, cho thấy còn dư địa tăng
• MACD cho tín hiệu mua với đường signal vượt lên
• Khối lượng giao dịch tăng 15% so với trung bình

**Yếu tố hỗ trợ:**
• Kết quả kinh doanh Q4 vượt kỳ vọng
• Kế hoạch mở rộng thị trường xuất khẩu
• Ngành sữa được dự báo phục hồi mạnh

**Rủi ro cần lưu ý:**
• Biến động giá nguyên liệu đầu vào
• Cạnh tranh từ các thương hiệu nước ngoài

**Khuyến nghị:** Mua và nắm giữ với mục tiêu 86,000 VND, stop-loss tại 80,500 VND.`,
    suggestions: [
      "Phân tích kỹ thuật VNM chi tiết hơn",
      "So sánh VNM với các cổ phiếu ngành sữa khác",
      "Lịch sử giá VNM 6 tháng qua",
    ],
  },
  "so sánh hpg hsg": {
    content: `**So sánh HPG vs HSG - Ngành thép:**

| Chỉ số | HPG | HSG |
|--------|-----|-----|
| **Giá hiện tại** | 25,100 VND | 18,750 VND |
| **P/E Ratio** | 8.9x | 12.3x |
| **ROE** | 15.2% | 11.8% |
| **Debt/Equity** | 0.55 | 0.68 |
| **Vốn hóa** | 71.2T | 28.5T |

**Ưu điểm HPG:**
✅ Quy mô lớn hơn, vị thế dẫn đầu thị trường
✅ Hiệu quả tài chính tốt hơn (ROE cao, P/E thấp)
✅ Cơ cấu nợ lành mạnh hơn
✅ Đầu tư công nghệ hiện đại

**Ưu điểm HSG:**
✅ Giá cổ phiếu thấp hơn, tiềm năng tăng trưởng
✅ Chuyên sâu vào thép xây dựng
✅ Chi phí sản xuất cạnh tranh

**Dự đoán AI:**
• **HPG:** Xu hướng tăng 3-5% trong 2 tuần tới
• **HSG:** Biến động ngang, có thể tăng nhẹ 1-2%

**Khuyến nghị:** HPG phù hợp cho đầu tư dài hạn, HSG phù hợp cho đầu cơ ngắn hạn.`,
    suggestions: ["Phân tích ngành thép Việt Nam", "Dự báo giá thép thế giới", "Top 5 cổ phiếu thép đáng chú ý"],
  },
  default: {
    content: `Tôi hiểu bạn quan tâm về thị trường chứng khoán. Tôi có thể giúp bạn:

**📊 Phân tích cổ phiếu:**
• Dự đoán xu hướng giá
• Phân tích kỹ thuật và cơ bản
• So sánh các mã cổ phiếu

**📈 Tư vấn đầu tư:**
• Đánh giá rủi ro và cơ hội
• Chiến lược đầu tư phù hợp
• Thời điểm mua/bán tối ưu

**📚 Giáo dục tài chính:**
• Giải thích các chỉ số tài chính
• Hướng dẫn đọc biểu đồ
• Kiến thức thị trường cơ bản

Hãy đặt câu hỏi cụ thể để tôi có thể hỗ trợ bạn tốt nhất!`,
    suggestions: ["Hướng dẫn đầu tư cho người mới", "Cách phân tích báo cáo tài chính", "Chiến lược đầu tư dài hạn"],
  },
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "ai",
      content: `Xin chào! Tôi là AI Tư vấn Tài chính của StockAI. 

Tôi có thể giúp bạn:
• Phân tích và dự đoán giá cổ phiếu
• Giải thích các chỉ số tài chính
• Tư vấn chiến lược đầu tư
• So sánh các mã cổ phiếu
• Phân tích xu hướng thị trường

Bạn có câu hỏi gì về thị trường chứng khoán không?`,
      timestamp: new Date(),
      suggestions: quickSuggestions.slice(0, 3),
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const getAIResponse = (userMessage: string): { content: string; suggestions?: string[] } => {
    const message = userMessage.toLowerCase()

    if (message.includes("vnm") && (message.includes("xu hướng") || message.includes("dự đoán"))) {
      return mockAIResponses["xu hướng vnm"]
    }

    if ((message.includes("hpg") && message.includes("hsg")) || message.includes("so sánh")) {
      return mockAIResponses["so sánh hpg hsg"]
    }

    return mockAIResponses.default
  }

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: content.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setIsTyping(true)

    // Simulate AI thinking time
    setTimeout(() => {
      const aiResponse = getAIResponse(content)
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "ai",
        content: aiResponse.content,
        timestamp: new Date(),
        suggestions: aiResponse.suggestions,
      }

      setMessages((prev) => [...prev, aiMessage])
      setIsTyping(false)
    }, 1500)
  }

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSendMessage(inputValue)
  }

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-4 ${message.type === "user" ? "justify-end" : ""}`}>
              {message.type === "ai" && (
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
              )}

              <div className={`max-w-[80%] ${message.type === "user" ? "order-first" : ""}`}>
                <div
                  className={`p-4 rounded-lg ${
                    message.type === "user" ? "bg-primary text-primary-foreground ml-auto" : "bg-muted text-foreground"
                  }`}
                >
                  <div className="prose prose-sm max-w-none">
                    {message.content.split("\n").map((line, index) => {
                      if (line.startsWith("**") && line.endsWith("**")) {
                        return (
                          <div key={index} className="font-bold mt-2 mb-1">
                            {line.slice(2, -2)}
                          </div>
                        )
                      }
                      if (line.startsWith("• ") || line.startsWith("✅ ")) {
                        return (
                          <div key={index} className="ml-2 mb-1">
                            {line}
                          </div>
                        )
                      }
                      if (line.includes("|")) {
                        return (
                          <div key={index} className="font-mono text-sm bg-background/50 p-1 rounded">
                            {line}
                          </div>
                        )
                      }
                      return line ? (
                        <div key={index} className="mb-1">
                          {line}
                        </div>
                      ) : (
                        <br key={index} />
                      )
                    })}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                  {message.type === "ai" && <Sparkles className="h-3 w-3" />}
                  {message.timestamp.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                </div>

                {/* AI Suggestions */}
                {message.type === "ai" && message.suggestions && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs text-muted-foreground">Câu hỏi gợi ý:</div>
                    <div className="flex flex-wrap gap-2">
                      {message.suggestions.map((suggestion, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="text-xs h-7 bg-transparent"
                        >
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {message.type === "user" && (
                <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-secondary-foreground" />
                </div>
              )}
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                  <div
                    className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  />
                  <div
                    className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-border p-4">
          {/* Quick Suggestions */}
          <div className="mb-4">
            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <HelpCircle className="h-3 w-3" />
              Câu hỏi phổ biến:
            </div>
            <div className="flex flex-wrap gap-2">
              {quickSuggestions.slice(0, 4).map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="text-xs h-7 bg-transparent"
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>

          {/* Message Input */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Đặt câu hỏi về cổ phiếu, thị trường..."
              className="flex-1"
              disabled={isTyping}
            />
            <Button type="submit" disabled={!inputValue.trim() || isTyping}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}
