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
      title="Account Settings"
      description="Please sign in with your Google account to manage your profile details, notification preferences, and security settings."
    >
      <div className="min-h-screen relative">
        <div
          className="fixed inset-0 bg-cover bg-center pointer-events-none"
          style={{
            backgroundImage: "url('/img_bg.png')",
            opacity: 0.15,
            zIndex: -1,
          }}
        ></div>

        <Header />

        <main className="container mx-auto px-4 py-5 relative z-10">
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
