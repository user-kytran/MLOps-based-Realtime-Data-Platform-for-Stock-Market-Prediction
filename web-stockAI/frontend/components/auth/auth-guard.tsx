"use client"

import React from "react"
import Link from "next/link"
import { useAuth } from "@/lib/authContext"
import { Header } from "@/components/layout/header"
import { GoogleSignInButton } from "./google-sign-in-button"
import { Lock, ArrowLeft } from "lucide-react"

interface AuthGuardProps {
  children: React.ReactNode
  title?: string
  description?: string
}

export function AuthGuard({
  children,
  title = "Yêu cầu đăng nhập",
  description = "Vui lòng đăng nhập với tài khoản Google để tiếp tục sử dụng tính năng này.",
}: AuthGuardProps) {
  const { user, isLoading } = useAuth()

  // 1. Đang kiểm tra trạng thái phiên làm việc
  if (isLoading) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-gray-50/50">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/img_bg.png')",
            opacity: 0.15,
            zIndex: -1,
          }}
        />
        <Header />
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <div className="flex flex-col items-center gap-3">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
            <p className="text-xs font-medium text-gray-500">Đang tải...</p>
          </div>
        </div>
      </div>
    )
  }

  // 2. Chưa đăng nhập -> Hiển thị hộp thoại đăng nhập chuyên nghiệp, tối giản
  if (!user) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-gray-50/50">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/img_bg.png')",
            opacity: 0.12,
            zIndex: -1,
          }}
        />
        <Header />

        <main className="container mx-auto px-4 py-16 lg:py-24 relative z-10 flex items-center justify-center">
          <div className="w-full max-w-md bg-white rounded-xl border border-gray-200/90 p-8 shadow-sm text-center">
            {/* Minimalist Security Lock Icon */}
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 border border-gray-200 text-gray-700">
              <Lock className="h-5 w-5 text-gray-700" />
            </div>

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
                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors pt-2"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Quay về Trang chủ</span>
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // 3. Đã đăng nhập -> Hiển thị nội dung
  return <>{children}</>
}
