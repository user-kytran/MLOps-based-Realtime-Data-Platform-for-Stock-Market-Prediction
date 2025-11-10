"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Eye, Plus, TrendingUp, TrendingDown, X, Search } from "lucide-react"
import Link from "next/link"

const mockWatchlist = [
  { symbol: "VNM", name: "Vinamilk", price: 82500, change: 1.2, volume: "2.1M", alert: true },
  { symbol: "VIC", name: "Vingroup", price: 45200, change: -0.8, volume: "3.5M", alert: false },
  { symbol: "VHM", name: "Vinhomes", price: 55800, change: 2.1, volume: "1.8M", alert: true },
  { symbol: "HPG", name: "Hoa Phat Group", price: 25100, change: -1.5, volume: "4.2M", alert: false },
  { symbol: "TCB", name: "Techcombank", price: 23450, change: 0.9, volume: "2.7M", alert: true },
]

export function Watchlist() {
  const [watchlist, setWatchlist] = useState(mockWatchlist)
  const [newStock, setNewStock] = useState("")
  const [showAddForm, setShowAddForm] = useState(false)

  const removeFromWatchlist = (symbol: string) => {
    setWatchlist((prev) => prev.filter((stock) => stock.symbol !== symbol))
  }

  const toggleAlert = (symbol: string) => {
    setWatchlist((prev) => prev.map((stock) => (stock.symbol === symbol ? { ...stock, alert: !stock.alert } : stock)))
  }

  const addToWatchlist = () => {
    if (newStock.trim()) {
      // Mock adding new stock
      const newStockData = {
        symbol: newStock.toUpperCase(),
        name: "Công ty mới",
        price: 50000,
        change: 0,
        volume: "1.0M",
        alert: false,
      }
      setWatchlist((prev) => [...prev, newStockData])
      setNewStock("")
      setShowAddForm(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Danh sách theo dõi ({watchlist.length})
          </CardTitle>
          <Button size="sm" onClick={() => setShowAddForm(!showAddForm)} className="gap-1">
            <Plus className="h-4 w-4" />
            Thêm cổ phiếu
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Add Stock Form */}
        {showAddForm && (
          <div className="mb-6 p-4 border border-border rounded-lg bg-muted/30">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Nhập mã cổ phiếu (VD: VNM, VIC...)"
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={addToWatchlist} disabled={!newStock.trim()}>
                Thêm
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Hủy
              </Button>
            </div>
          </div>
        )}

        {/* Watchlist Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Mã CP</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Tên công ty</th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Giá</th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Thay đổi</th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Khối lượng</th>
                <th className="text-center py-3 px-2 font-medium text-muted-foreground">Cảnh báo</th>
                <th className="text-center py-3 px-2 font-medium text-muted-foreground">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {watchlist.map((stock) => (
                <tr key={stock.symbol} className="border-b border-border hover:bg-muted/50 transition-colors">
                  <td className="py-4 px-2">
                    <Link href={`/stock/${stock.symbol}`}>
                      <span className="font-bold text-primary hover:text-primary/80 transition-colors">
                        {stock.symbol}
                      </span>
                    </Link>
                  </td>
                  <td className="py-4 px-2">
                    <span className="text-foreground">{stock.name}</span>
                  </td>
                  <td className="py-4 px-2 text-right">
                    <span className="font-mono font-medium">{stock.price.toLocaleString("vi-VN")}</span>
                  </td>
                  <td className="py-4 px-2 text-right">
                    <Badge
                      variant={stock.change >= 0 ? "default" : "destructive"}
                      className={`${stock.change >= 0 ? "bg-success hover:bg-success/80" : ""} font-mono`}
                    >
                      {stock.change >= 0 ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      )}
                      {stock.change >= 0 ? "+" : ""}
                      {stock.change}%
                    </Badge>
                  </td>
                  <td className="py-4 px-2 text-right font-mono text-muted-foreground">{stock.volume}</td>
                  <td className="py-4 px-2 text-center">
                    <Button
                      variant={stock.alert ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleAlert(stock.symbol)}
                      className={stock.alert ? "bg-warning hover:bg-warning/80" : ""}
                    >
                      {stock.alert ? "Bật" : "Tắt"}
                    </Button>
                  </td>
                  <td className="py-4 px-2 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFromWatchlist(stock.symbol)}
                      className="text-destructive hover:text-destructive/80"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {watchlist.length === 0 && (
          <div className="text-center py-8">
            <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">Chưa có cổ phiếu nào trong danh sách theo dõi</p>
            <Button onClick={() => setShowAddForm(true)}>Thêm cổ phiếu đầu tiên</Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
