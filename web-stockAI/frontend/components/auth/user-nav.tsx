"use client"

import React, { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { useAuth } from "@/lib/authContext"
import { useOnboarding } from "@/lib/onboardingContext"

export function UserNav() {
  const { user, logout } = useAuth()
  const { openWelcome } = useOnboarding()
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
        className="flex items-center gap-2 rounded-full p-0.5 border border-slate-200 hover:border-cyan-500 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
        aria-label="User profile menu"
      >
        {user.avatar_url ? (
          <Image
            src={user.avatar_url}
            alt={user.name || user.email}
            width={30}
            height={30}
            className="rounded-full object-cover"
            unoptimized
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-cyan-700 text-white flex items-center justify-center text-xs font-semibold">
            {getInitials(user.name, user.email)}
          </div>
        )}
        <div className="hidden lg:flex flex-col text-left pr-2">
          <span className="text-xs font-semibold text-slate-800 max-w-[110px] truncate leading-tight">
            {user.name || user.email.split("@")[0]}
          </span>
          <span className="text-[10px] text-slate-500 capitalize leading-tight">
            {user.role || "Member"}
          </span>
        </div>
      </button>

      {/* Dropdown Menu - Clean, lightweight, lowercase subtle design */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-lg bg-white/95 backdrop-blur-md p-1.5 shadow-lg ring-1 ring-black/5 z-50 border border-slate-200 animate-in fade-in-0 zoom-in-95">
          {/* User Details */}
          <div className="px-3 py-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              {user.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt={user.name || user.email}
                  width={34}
                  height={34}
                  className="rounded-full object-cover shrink-0 border border-slate-200"
                  unoptimized
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-cyan-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {getInitials(user.name, user.email)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {user.name || "StockAI Trader"}
                </p>
                <p className="text-[11px] text-slate-500 font-mono truncate" title={user.email}>
                  {user.email}
                </p>
              </div>
            </div>

            {/* Account Status Tags - Light, delicate, lowercase */}
            <div className="mt-2 flex items-center gap-1.5">
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-normal text-slate-500 bg-slate-50 border border-slate-200">
                google verified
              </span>
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-normal text-slate-500 bg-slate-50 border border-slate-200 lowercase">
                {user.role || "user"}
              </span>
            </div>
          </div>

          {/* Menu Actions - Subtle lowercase buttons */}
          <div className="pt-1 space-y-0.5">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                openWelcome()
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-normal text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors text-left cursor-pointer"
            >
              <span className="text-[11px] font-normal text-slate-600">Platform guide</span>
              <span className="text-[9px] font-normal text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200/80 lowercase">
                tour
              </span>
            </button>

            <button
              type="button"
              onClick={async () => {
                setIsOpen(false)
                await logout()
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-normal text-slate-600 hover:text-red-600 hover:bg-red-50/50 rounded-md transition-colors text-left cursor-pointer"
            >
              <span className="text-[11px] font-normal text-slate-600">Sign out</span>
              <span className="text-[9px] font-normal text-slate-400 lowercase">disconnect</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
