"use client"

import React, { useEffect, useRef, useState } from "react"
import { useAuth } from "@/lib/authContext"

declare global {
  interface Window {
    google?: any
    __onGoogleSignInCallback?: (response: { credential?: string }) => void
  }
}

let isGsiInitialized = false
let currentInitializedClientId = ""

interface GoogleSignInButtonProps {
  className?: string
  customLabel?: string
  theme?: "outline" | "filled_blue" | "filled_black"
  size?: "large" | "medium" | "small"
  shape?: "rectangular" | "pill" | "circle" | "square"
}

export function GoogleSignInButton({
  className = "",
  customLabel = "Login",
  theme = "outline",
  size = "medium",
  shape = "pill",
}: GoogleSignInButtonProps) {
  const { loginWithCredential, googleClientId, error } = useAuth()
  const buttonContainerRef = useRef<HTMLDivElement>(null)
  const [isScriptLoaded, setIsScriptLoaded] = useState(false)
  const [isSigningIn, setIsSigningIn] = useState(false)

  // Đăng ký callback global cho Google GSI
  useEffect(() => {
    window.__onGoogleSignInCallback = async (response: { credential?: string }) => {
      if (response?.credential) {
        await loginWithCredential(response.credential)
        setIsSigningIn(false)
      }
    }
  }, [loginWithCredential])

  // 1. Tải Google Identity Services Client Script
  useEffect(() => {
    if (typeof window === "undefined") return

    if (window.google?.accounts?.id) {
      setIsScriptLoaded(true)
      return
    }

    const scriptId = "google-gsi-client-script"
    let script = document.getElementById(scriptId) as HTMLScriptElement

    if (!script) {
      script = document.createElement("script")
      script.id = scriptId
      script.src = "https://accounts.google.com/gsi/client"
      script.async = true
      script.defer = true
      script.onload = () => setIsScriptLoaded(true)
      document.head.appendChild(script)
    } else {
      script.addEventListener("load", () => setIsScriptLoaded(true))
      if (window.google?.accounts?.id) {
        setIsScriptLoaded(true)
      }
    }
  }, [])

  // 2. Khởi tạo GSI & Render nút đăng nhập chuẩn của Google
  useEffect(() => {
    if (!isScriptLoaded || !googleClientId || !window.google?.accounts?.id) {
      return
    }

    try {
      if (!isGsiInitialized || currentInitializedClientId !== googleClientId) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response: { credential?: string }) => {
            if (window.__onGoogleSignInCallback) {
              window.__onGoogleSignInCallback(response)
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        })
        isGsiInitialized = true
        currentInitializedClientId = googleClientId
      }

      if (buttonContainerRef.current) {
        buttonContainerRef.current.innerHTML = ""
        window.google.accounts.id.renderButton(buttonContainerRef.current, {
          theme,
          size: size === "large" ? "large" : "medium",
          text: "signin",
          shape,
          logo_alignment: "left",
          locale: "en",
          width: size === "large" ? 220 : 130,
        })
      }
    } catch {
      // Fallback to custom button
    }
  }, [isScriptLoaded, googleClientId, theme, size, shape])

  const handleManualClick = () => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt()
    }
  }

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      {/* 1. Nút hiển thị giao diện tùy chỉnh chuẩn: Logo Google + chữ "Login" */}
      <button
        type="button"
        onClick={handleManualClick}
        disabled={isSigningIn}
        className={`inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white font-semibold text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50 active:scale-95 ${
          size === "large" ? "px-5 py-2 text-sm" : "px-3.5 py-1.5 text-xs"
        }`}
      >
        {isSigningIn ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
        ) : (
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        )}
        <span className="notranslate" translate="no">
          {isSigningIn ? "Signing in..." : customLabel}
        </span>
      </button>

      {/* 2. Container phủ iframe Google GSI chính thức lên trên để đảm bảo 100% click mở popup đăng nhập */}
      <div
        ref={buttonContainerRef}
        className="absolute inset-0 opacity-0 overflow-hidden cursor-pointer z-10 flex items-center justify-center pointer-events-auto"
      />

      {error && (
        <span className="absolute -bottom-5 text-[11px] text-red-500 font-medium whitespace-nowrap">
          {error}
        </span>
      )}
    </div>
  )
}
