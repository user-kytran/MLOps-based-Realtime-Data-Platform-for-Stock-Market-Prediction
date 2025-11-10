"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User, Camera } from "lucide-react"

export function UserProfile() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          Thông tin cá nhân
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar Section */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="w-20 h-20">
              <AvatarImage src="/placeholder-avatar.jpg" />
              <AvatarFallback className="text-lg">NV</AvatarFallback>
            </Avatar>
            <Button size="sm" variant="outline" className="absolute -bottom-2 -right-2 rounded-full p-2 bg-transparent">
              <Camera className="h-3 w-3" />
            </Button>
          </div>
          <div>
            <h3 className="font-semibold">Nguyễn Văn A</h3>
            <p className="text-sm text-muted-foreground">Nhà đầu tư cá nhân</p>
            <p className="text-sm text-muted-foreground">Tham gia từ: Tháng 1, 2024</p>
          </div>
        </div>

        {/* Profile Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">Họ</Label>
            <Input id="firstName" placeholder="Nguyễn" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Tên</Label>
            <Input id="lastName" placeholder="Văn A" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="nguyenvana@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Số điện thoại</Label>
            <Input id="phone" type="tel" placeholder="0123 456 789" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Địa chỉ</Label>
            <Input id="location" placeholder="Hà Nội, Việt Nam" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="occupation">Nghề nghiệp</Label>
            <Input id="occupation" placeholder="Kỹ sư phần mềm" />
          </div>
        </div>

        <Button className="mt-4">Lưu thay đổi</Button>
      </CardContent>
    </Card>
  )
}
