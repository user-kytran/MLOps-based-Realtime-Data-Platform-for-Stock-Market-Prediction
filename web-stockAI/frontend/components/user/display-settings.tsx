"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTheme } from "@/components/layout/theme-provider"
import { Monitor, Globe, Eye } from "lucide-react"

export function DisplaySettings() {
  const { theme, setTheme } = useTheme()
  const [settings, setSettings] = useState({
    language: "vi",
    currency: "VND",
    dateFormat: "dd/mm/yyyy",
    compactMode: false,
    showAnimations: true,
    highContrast: false,
  })

  const handleSettingChange = (key: keyof typeof settings, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          Hiển thị
        </CardTitle>
        <CardDescription>Tùy chỉnh giao diện và hiển thị</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Theme Settings */}
        <div>
          <Label className="text-base font-medium">Chủ đề</Label>
          <p className="text-sm text-muted-foreground mb-3">Chọn chủ đề hiển thị</p>
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Sáng</SelectItem>
              <SelectItem value="dark">Tối</SelectItem>
              <SelectItem value="system">Theo hệ thống</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Language Settings */}
        <div>
          <Label className="text-base font-medium flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Ngôn ngữ
          </Label>
          <p className="text-sm text-muted-foreground mb-3">Chọn ngôn ngữ hiển thị</p>
          <Select value={settings.language} onValueChange={(value) => handleSettingChange("language", value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vi">Tiếng Việt</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Currency Settings */}
        <div>
          <Label className="text-base font-medium">Đơn vị tiền tệ</Label>
          <p className="text-sm text-muted-foreground mb-3">Hiển thị giá theo đơn vị</p>
          <Select value={settings.currency} onValueChange={(value) => handleSettingChange("currency", value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="VND">VND (₫)</SelectItem>
              <SelectItem value="USD">USD ($)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date Format */}
        <div>
          <Label className="text-base font-medium">Định dạng ngày</Label>
          <p className="text-sm text-muted-foreground mb-3">Cách hiển thị ngày tháng</p>
          <Select value={settings.dateFormat} onValueChange={(value) => handleSettingChange("dateFormat", value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dd/mm/yyyy">DD/MM/YYYY</SelectItem>
              <SelectItem value="mm/dd/yyyy">MM/DD/YYYY</SelectItem>
              <SelectItem value="yyyy-mm-dd">YYYY-MM-DD</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Display Options */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="compactMode">Chế độ thu gọn</Label>
              <p className="text-sm text-muted-foreground">Hiển thị giao diện nhỏ gọn hơn</p>
            </div>
            <Switch
              id="compactMode"
              checked={settings.compactMode}
              onCheckedChange={(checked) => handleSettingChange("compactMode", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="showAnimations">Hiệu ứng động</Label>
              <p className="text-sm text-muted-foreground">Bật/tắt các hiệu ứng chuyển động</p>
            </div>
            <Switch
              id="showAnimations"
              checked={settings.showAnimations}
              onCheckedChange={(checked) => handleSettingChange("showAnimations", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              <div>
                <Label htmlFor="highContrast">Độ tương phản cao</Label>
                <p className="text-sm text-muted-foreground">Tăng độ tương phản cho dễ nhìn</p>
              </div>
            </div>
            <Switch
              id="highContrast"
              checked={settings.highContrast}
              onCheckedChange={(checked) => handleSettingChange("highContrast", checked)}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button>Lưu cài đặt</Button>
        </div>
      </CardContent>
    </Card>
  )
}
