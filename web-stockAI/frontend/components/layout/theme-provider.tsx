"use client"

import React from "react"

// ThemeProvider chỉ còn nhiệm vụ bọc children, không quản lý dark/light nữa
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
