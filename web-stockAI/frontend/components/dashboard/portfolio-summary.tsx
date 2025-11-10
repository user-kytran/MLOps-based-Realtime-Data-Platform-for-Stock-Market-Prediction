"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { Briefcase, TrendingUp, TrendingDown } from "lucide-react"

const portfolioData = [
  { name: "Ngân hàng", value: 35, amount: 857500000, color: "#3b82f6" },
  { name: "Bất động sản", value: 25, amount: 612500000, color: "#10b981" },
  { name: "Công nghệ", value: 20, amount: 490000000, color: "#f59e0b" },
  { name: "Tiêu dùng", value: 15, amount: 367500000, color: "#ef4444" },
  { name: "Khác", value: 5, amount: 122500000, color: "#8b5cf6" },
]

const topHoldings = [
  { symbol: "VNM", name: "Vinamilk", shares: 1000, value: 82500000, change: 1.2 },
  { symbol: "VIC", name: "Vingroup", shares: 1500, value: 67800000, change: -0.8 },
  { symbol: "HPG", name: "Hoa Phat", shares: 2000, value: 50200000, change: -1.5 },
  { symbol: "TCB", name: "Techcombank", shares: 2200, value: 51590000, change: 0.9 },
]

export function PortfolioSummary() {
  const totalValue = portfolioData.reduce((sum, item) => sum + item.amount, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          Tóm tắt danh mục
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Portfolio Allocation */}
        <div>
          <h4 className="font-medium mb-3">Phân bổ theo ngành</h4>
          <div className="h-48 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={portfolioData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {portfolioData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value}%`,
                    portfolioData.find((item) => item.name === name)?.amount.toLocaleString("vi-VN") + " VND",
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {portfolioData.map((sector) => (
              <div key={sector.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sector.color }} />
                  <span>{sector.name}</span>
                </div>
                <div className="text-right">
                  <div className="font-mono">{sector.value}%</div>
                  <div className="text-xs text-muted-foreground">{(sector.amount / 1000000).toFixed(0)}M VND</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Holdings */}
        <div>
          <h4 className="font-medium mb-3">Nắm giữ lớn nhất</h4>
          <div className="space-y-3">
            {topHoldings.map((holding) => (
              <div key={holding.symbol} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <div className="font-bold text-sm text-primary">{holding.symbol}</div>
                  <div className="text-xs text-muted-foreground">{holding.shares.toLocaleString("vi-VN")} CP</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">{(holding.value / 1000000).toFixed(1)}M</div>
                  <Badge
                    variant={holding.change >= 0 ? "default" : "destructive"}
                    className={`${holding.change >= 0 ? "bg-success hover:bg-success/80" : ""} text-xs`}
                  >
                    {holding.change >= 0 ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {holding.change >= 0 ? "+" : ""}
                    {holding.change}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Portfolio Stats */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Tổng giá trị</div>
            <div className="font-bold font-mono">{(totalValue / 1000000000).toFixed(2)}B</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Số mã CP</div>
            <div className="font-bold">{topHoldings.length}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
