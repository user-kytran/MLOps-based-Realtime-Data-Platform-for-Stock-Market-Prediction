"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Bell, Mail, Smartphone, TrendingUp, AlertTriangle } from "lucide-react"

export function NotificationSettings() {
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    sms: false,
    priceAlerts: true,
    newsUpdates: true,
    marketOpen: false,
    portfolioUpdates: true,
    aiPredictions: true,
  })

  const handleToggle = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Cài đặt thông báo
        </CardTitle>
        <CardDescription>Quản lý cách bạn nhận thông báo về cổ phiếu và thị trường</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Notification Channels */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Kênh thông báo</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="email">Email</Label>
                  <p className="text-sm text-muted-foreground">Nhận thông báo qua email</p>
                </div>
              </div>
              <Switch id="email" checked={notifications.email} onCheckedChange={() => handleToggle("email")} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="push">Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">Thông báo đẩy trên thiết bị</p>
                </div>
              </div>
              <Switch id="push" checked={notifications.push} onCheckedChange={() => handleToggle("push")} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="sms">SMS</Label>
                  <p className="text-sm text-muted-foreground">Thông báo qua tin nhắn</p>
                </div>
              </div>
              <Switch id="sms" checked={notifications.sms} onCheckedChange={() => handleToggle("sms")} />
            </div>
          </div>
        </div>

        {/* Notification Types */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Loại thông báo</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="priceAlerts">Cảnh báo giá</Label>
                  <p className="text-sm text-muted-foreground">Thông báo khi giá cổ phiếu thay đổi</p>
                </div>
              </div>
              <Switch
                id="priceAlerts"
                checked={notifications.priceAlerts}
                onCheckedChange={() => handleToggle("priceAlerts")}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="newsUpdates">Tin tức mới</Label>
                  <p className="text-sm text-muted-foreground">Cập nhật tin tức thị trường</p>
                </div>
              </div>
              <Switch
                id="newsUpdates"
                checked={notifications.newsUpdates}
                onCheckedChange={() => handleToggle("newsUpdates")}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="portfolioUpdates">Cập nhật danh mục</Label>
                  <p className="text-sm text-muted-foreground">Thay đổi trong danh mục đầu tư</p>
                </div>
              </div>
              <Switch
                id="portfolioUpdates"
                checked={notifications.portfolioUpdates}
                onCheckedChange={() => handleToggle("portfolioUpdates")}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="aiPredictions">Dự đoán AI</Label>
                  <p className="text-sm text-muted-foreground">Thông báo dự đoán từ AI</p>
                </div>
              </div>
              <Switch
                id="aiPredictions"
                checked={notifications.aiPredictions}
                onCheckedChange={() => handleToggle("aiPredictions")}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button>Lưu cài đặt</Button>
        </div>
      </CardContent>
    </Card>
  )
}
