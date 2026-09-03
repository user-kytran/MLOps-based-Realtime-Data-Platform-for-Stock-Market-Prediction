"use client"

import React, { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { useAuth } from "@/lib/authContext"
import { LogOut, Shield, CheckCircle } from "lucide-react"

export function UserNav() {
  const { user, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  if (!user) return null

  const getInitials = (name?: string | null, email?: string) => {
    if (name) {
      const parts = name.trim().split(" ")
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      }
      return name.slice(0, 2).toUpperCase()
    }
    if (email) {
      return email.slice(0, 2).toUpperCase()
    }
    return "US"
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Avatar Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full p-0.5 border border-gray-200 hover:border-cyan-400 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
        aria-label="User profile menu"
      >
        {user.avatar_url ? (
          <Image
            src={user.avatar_url}
            alt={user.name || user.email}
            width={32}
            height={32}
            className="rounded-full object-cover"
            unoptimized
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
            {getInitials(user.name, user.email)}
          </div>
        )}
        <div className="hidden lg:flex flex-col text-left pr-2">
          <span className="text-xs font-semibold text-gray-800 max-w-[110px] truncate leading-tight">
            {user.name || user.email.split("@")[0]}
          </span>
          <span className="text-[10px] text-gray-400 capitalize leading-tight">
            {user.role}
          </span>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white p-2 shadow-xl ring-1 ring-black/5 z-50 border border-gray-100 animate-in fade-in-0 zoom-in-95">
          {/* User Details */}
          <div className="px-3 py-2.5 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              {user.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt={user.name || user.email}
                  width={36}
                  height={36}
                  className="rounded-full object-cover shrink-0"
                  unoptimized
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {getInitials(user.name, user.email)}
                </div>
              )}
              <div className="overflow-hidden">
                <div className="flex items-center gap-1">
                  <p className="text-xs font-bold text-gray-900 truncate">
                    {user.name || "StockAI Trader"}
                  </p>
                  <CheckCircle className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                </div>
                <p className="text-[11px] text-gray-500 truncate" title={user.email}>
                  {user.email}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200/50">
                <Shield className="w-2.5 h-2.5" /> Google Verified
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 uppercase">
                {user.role}
              </span>
            </div>
          </div>

          {/* Menu Actions */}
          <div className="pt-1">
            <button
              type="button"
              onClick={async () => {
                setIsOpen(false)
                await logout()
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left"
            >
              <LogOut className="w-4 h-4" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
