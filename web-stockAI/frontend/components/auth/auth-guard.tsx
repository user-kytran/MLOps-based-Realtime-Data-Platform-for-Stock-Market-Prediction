"use client"

import React from "react"
import Link from "next/link"
import { useAuth } from "@/lib/authContext"
import { Header } from "@/components/layout/header"
import { GoogleSignInButton } from "./google-sign-in-button"

interface AuthGuardProps {
  children: React.ReactNode
  title?: string
  description?: string
}

export function AuthGuard({
  children,
  title = "Sign in required",
  description = "Please sign in with your Google account to access this feature.",
}: AuthGuardProps) {
  const { user, isLoading } = useAuth()

  // 1. Session verification state
  if (isLoading) {
    return (
      <div className="min-h-screen relative bg-gray-50/50">
        <div
          className="fixed inset-0 bg-cover bg-center pointer-events-none"
          style={{
            backgroundImage: "url('/img_bg.png')",
            opacity: 0.15,
            zIndex: -1,
          }}
        />
        <Header />
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
            <p className="text-xs font-medium text-gray-500 font-mono">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  // 2. Unauthenticated state -> Clean typography-driven login dialog (No lock icon)
  if (!user) {
    return (
      <div className="min-h-screen relative bg-gray-50/50">
        <div
          className="fixed inset-0 bg-cover bg-center pointer-events-none"
          style={{
            backgroundImage: "url('/img_bg.png')",
            opacity: 0.12,
            zIndex: -1,
          }}
        />
        <Header />

        <main className="container mx-auto px-4 py-16 lg:py-24 relative z-10 flex items-center justify-center">
          <div className="w-full max-w-md bg-white rounded-xl border border-gray-200/90 p-8 shadow-sm text-center">
            {/* Title & Description */}
            <h1 className="text-lg font-bold text-gray-900 mb-2 tracking-tight">
              {title}
            </h1>
            <p className="text-xs md:text-sm text-gray-600 mb-6 max-w-sm mx-auto leading-relaxed">
              {description}
            </p>

            {/* Google Sign-In Action */}
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="w-full flex justify-center py-1">
                <GoogleSignInButton size="large" shape="pill" />
              </div>

              {/* Back to Homepage */}
              <Link
                href="/"
                className="inline-flex items-center text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors pt-2"
              >
                &larr; Back to Homepage
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // 3. Authenticated -> Render protected content
  return <>{children}</>
}
