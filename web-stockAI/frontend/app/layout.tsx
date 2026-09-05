import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/layout/theme-provider"
import { StockWSProvider } from "@/lib/stockWSContext"
import { AuthProvider } from "@/lib/authContext"
import { OnboardingProvider } from "@/lib/onboardingContext"
import { WelcomeModal, GuideTour } from "@/components/onboarding"
import { AgentationDev } from "@/components/agentation-dev"

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-sans",
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "vietnamese"],
  variable: "--font-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: "StockAI - Predict stock price smart",
  description: "Analyze stock market with AI, track price trends and get accurate predictions",
  generator: 'v0.app',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#06b6d4',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <AuthProvider>
          <OnboardingProvider>
            <ThemeProvider>
              <StockWSProvider>
                {children}
                <WelcomeModal />
                <GuideTour />
              </StockWSProvider>
            </ThemeProvider>
          </OnboardingProvider>
        </AuthProvider>
        <AgentationDev />
      </body>
    </html>
  )
}
