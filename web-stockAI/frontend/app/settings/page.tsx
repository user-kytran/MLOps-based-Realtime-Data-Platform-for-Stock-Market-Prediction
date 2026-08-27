import { Header } from "@/components/layout/header"
import { UserProfile } from "@/components/user/user-profile"
import { NotificationSettings } from "@/components/user/notification-settings"
import { DisplaySettings } from "@/components/user/display-settings"
import { SecuritySettings } from "@/components/user/security-settings"

export default function SettingsPage() {
  return (
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
  )
}
