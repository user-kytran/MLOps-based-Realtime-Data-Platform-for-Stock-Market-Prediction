"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calculator, TrendingUp, DollarSign } from "lucide-react"

// Mock financial data
const getFinancialData = (symbol: string) => {
  const mockData = {
    VNM: {
      pe: 18.5,
      eps: 4460,
      marketCap: "195.2T",
      revenue: "58.2T",
      profit: "10.8T",
      dividend: 2200,
      dividendYield: 2.67,
      roe: 24.1,
      roa: 12.3,
      debtToEquity: 0.45,
      currentRatio: 1.8,
      bookValue: 18650,
    },
  }
  return mockData[symbol as keyof typeof mockData] || mockData.VNM
}

interface FinancialDataProps {
  symbol: string
}

export function FinancialData({ symbol }: FinancialDataProps) {
  const data = getFinancialData(symbol)

  const financialMetrics = [
    { label: "P/E Ratio", value: data.pe, suffix: "x", description: "Tỷ lệ giá/thu nhập" },
    { label: "EPS", value: data.eps, suffix: " VND", description: "Thu nhập trên cổ phiếu" },
    { label: "ROE", value: data.roe, suffix: "%", description: "Tỷ suất sinh lời trên vốn chủ sở hữu" },
    { label: "ROA", value: data.roa, suffix: "%", description: "Tỷ suất sinh lời trên tài sản" },
    { label: "Debt/Equity", value: data.debtToEquity, suffix: "", description: "Tỷ lệ nợ/vốn chủ sở hữu" },
    { label: "Current Ratio", value: data.currentRatio, suffix: "", description: "Tỷ lệ thanh khoản hiện tại" },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          Thông tin tài chính
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground">Vốn hóa</div>
              <div className="text-lg font-bold font-mono">{data.marketCap}</div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground">Doanh thu</div>
              <div className="text-lg font-bold font-mono">{data.revenue}</div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground">Lợi nhuận</div>
              <div className="text-lg font-bold font-mono">{data.profit}</div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground">Giá trị sổ sách</div>
              <div className="text-lg font-bold font-mono">{data.bookValue.toLocaleString("vi-VN")}</div>
            </div>
          </div>

          {/* Dividend Information */}
          <div className="p-4 border border-border rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="font-medium">Cổ tức</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Cổ tức/cổ phiếu</div>
                <div className="text-lg font-bold font-mono">{data.dividend.toLocaleString("vi-VN")} VND</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Tỷ suất cổ tức</div>
                <div className="text-lg font-bold">
                  {data.dividendYield}%
                  <Badge variant="outline" className="ml-2 text-xs">
                    Ổn định
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Ratios */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Chỉ số tài chính
            </h4>
            <div className="space-y-3">
              {financialMetrics.map((metric) => (
                <div key={metric.label} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <div className="font-medium text-sm">{metric.label}</div>
                    <div className="text-xs text-muted-foreground">{metric.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold font-mono">
                      {typeof metric.value === "number" ? metric.value.toLocaleString("vi-VN") : metric.value}
                      {metric.suffix}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Summary */}
          <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-success" />
              <span className="font-medium text-success">Đánh giá tổng quan</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Công ty có tình hình tài chính ổn định với ROE cao và tỷ lệ nợ hợp lý. Cổ tức được duy trì ổn định qua các
              năm.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
