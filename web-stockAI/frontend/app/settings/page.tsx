"use client"

import { Header } from "@/components/layout/header"
import { UserProfile } from "@/components/user/user-profile"
import { NotificationSettings } from "@/components/user/notification-settings"
import { DisplaySettings } from "@/components/user/display-settings"
import { SecuritySettings } from "@/components/user/security-settings"
import { AuthGuard } from "@/components/auth"

export default function SettingsPage() {
  return (
    <AuthGuard
      title="Cài đặt Tài khoản"
      description="Vui lòng đăng nhập với tài khoản Google để xem và quản lý thông tin tài khoản, cài đặt thông báo và bảo mật."
    >
      <div className="min-h-screen bg-background">
        <Header />

        <main className="container mx-auto px-4 py-5">
          {/* Page Header */}
          <div className="mb-4">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your account and customize your experience</p>
          </div>

          {/* Settings Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left Column - Main Settings */}
            <div className="lg:col-span-2 space-y-4">
              <UserProfile />
              <NotificationSettings />
              <SecuritySettings />
            </div>

            {/* Right Column - Display Settings */}
            <div>
              <DisplaySettings />
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}
