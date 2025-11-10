"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bell, TrendingUp, AlertTriangle, Settings, BarChart3 } from "lucide-react"

const alerts = [
  {
    id: 1,
    type: "price",
    title: "VNM > 82,000",
    description: "Giá VNM vượt ngưỡng cảnh báo",
    status: "active",
    triggered: true,
  },
  {
    id: 2,
    type: "volume",
    title: "VIC khối lượng cao",
    description: "Khối lượng VIC tăng 200% so với TB",
    status: "active",
    triggered: false,
  },
  {
    id: 3,
    type: "news",
    title: "Tin tức HPG",
    description: "Có tin tức mới về HPG",
    status: "active",
    triggered: false,
  },
  {
    id: 4,
    type: "technical",
    title: "TCB RSI > 70",
    description: "TCB vào vùng quá mua",
    status: "paused",
    triggered: false,
  },
]

export function MarketAlerts() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Cảnh báo thị trường
          </CardTitle>
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`p-3 rounded-lg border transition-colors ${
              alert.triggered ? "border-warning bg-warning/10" : "border-border hover:bg-muted/50"
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {alert.type === "price" && <TrendingUp className="h-4 w-4 text-primary" />}
                {alert.type === "volume" && <BarChart3 className="h-4 w-4 text-primary" />}
                {alert.type === "news" && <Bell className="h-4 w-4 text-primary" />}
                {alert.type === "technical" && <AlertTriangle className="h-4 w-4 text-primary" />}
                <span className="font-medium text-sm">{alert.title}</span>
              </div>
              <div className="flex items-center gap-2">
                {alert.triggered && <Badge className="bg-warning hover:bg-warning/80 text-xs">Kích hoạt</Badge>}
                <Badge variant={alert.status === "active" ? "default" : "secondary"} className="text-xs">
                  {alert.status === "active" ? "Hoạt động" : "Tạm dừng"}
                </Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{alert.description}</p>
          </div>
        ))}

        <Button variant="outline" className="w-full bg-transparent">
          <Bell className="h-4 w-4 mr-2" />
          Tạo cảnh báo mới
        </Button>
      </CardContent>
    </Card>
  )
}
