"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Eye, AlertCircle } from "lucide-react"

const portfolioMetrics = [
  {
    title: "Tổng giá trị danh mục",
    value: "2,450,000,000",
    change: 5.2,
    changeValue: "+120,000,000",
    icon: DollarSign,
  },
  {
    title: "Lợi nhuận hôm nay",
    value: "45,600,000",
    change: 1.9,
    changeValue: "+1.9%",
    icon: TrendingUp,
  },
  {
    title: "Tổng lợi nhuận",
    value: "380,000,000",
    change: 18.4,
    changeValue: "+18.4%",
    icon: BarChart3,
  },
  {
    title: "Cổ phiếu theo dõi",
    value: "24",
    change: 0,
    changeValue: "cổ phiếu",
    icon: Eye,
  },
]

export function DashboardOverview() {
  return (
    <div className="space-y-6">
      {/* Portfolio Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {portfolioMetrics.map((metric) => {
          const Icon = metric.icon
          return (
            <Card key={metric.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  {metric.change !== 0 && (
                    <Badge
                      variant={metric.change >= 0 ? "default" : "destructive"}
                      className={`${metric.change >= 0 ? "bg-success hover:bg-success/80" : ""} text-xs`}
                    >
                      {metric.change >= 0 ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      )}
                      {metric.change >= 0 ? "+" : ""}
                      {metric.change}%
                    </Badge>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{metric.title}</p>
                  <p className="text-2xl font-bold font-mono">
                    {metric.title.includes("Tổng") || metric.title.includes("Lợi nhuận")
                      ? `${Number.parseInt(metric.value).toLocaleString("vi-VN")} VND`
                      : metric.value}
                  </p>
                  <p className="text-sm text-muted-foreground">{metric.changeValue}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Hành động nhanh</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer text-center">
              <TrendingUp className="h-6 w-6 text-primary mx-auto mb-2" />
              <div className="font-medium text-sm">Thêm cổ phiếu</div>
            </div>
            <div className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer text-center">
              <BarChart3 className="h-6 w-6 text-primary mx-auto mb-2" />
              <div className="font-medium text-sm">Phân tích danh mục</div>
            </div>
            <div className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer text-center">
              <AlertCircle className="h-6 w-6 text-primary mx-auto mb-2" />
              <div className="font-medium text-sm">Cài đặt cảnh báo</div>
            </div>
            <div className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer text-center">
              <Eye className="h-6 w-6 text-primary mx-auto mb-2" />
              <div className="font-medium text-sm">Xem báo cáo</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
