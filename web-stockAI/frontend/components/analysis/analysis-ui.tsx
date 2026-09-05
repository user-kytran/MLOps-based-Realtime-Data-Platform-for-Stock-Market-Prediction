"use client"

import { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export const chartColors = {
  positive: "#16a34a", // green-600
  positiveDark: "#15803d",
  negative: "#dc2626", // red-600
  negativeDark: "#b91c1c",
  neutral: "#64748b", // slate-500
  accent: "#0891b2", // cyan-600 (brand)
  cyanDark: "#0e7490",
  amber: "#d97706",
  grid: "#f1f5f9",
  axis: "#64748b",
}

export const sectorPalette = [
  "#0891b2", // cyan-600
  "#2563eb", // blue-600
  "#059669", // emerald-600
  "#7c3aed", // violet-600
  "#ea580c", // orange-600
  "#dc2626", // red-600
  "#0284c7", // sky-600
  "#4f46e5", // indigo-600
  "#ca8a04", // yellow-600
  "#db2777", // pink-600
  "#475569", // slate-600
]

export const tooltipStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "6px",
  boxShadow: "0 8px 20px -4px rgba(0, 0, 0, 0.08)",
  color: "#0f172a",
  fontSize: "12px",
  fontWeight: 500,
  padding: "8px 12px",
}

export const axisTick = {
  fill: "#64748b",
  fontSize: 11,
  fontWeight: 600,
  fontFamily: "var(--font-mono), ui-monospace, monospace",
}

interface AnalysisPanelProps {
  title: string
  eyebrow?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}

export function AnalysisPanel({
  title,
  eyebrow,
  action,
  children,
  className,
  contentClassName,
}: AnalysisPanelProps) {
  return (
    <Card className={cn("rounded-xl border-slate-200 bg-white shadow-xs transition-shadow duration-200 hover:shadow-sm overflow-hidden flex flex-col h-full", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3 shrink-0">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-800 mb-0.5">
              {eyebrow}
            </p>
          ) : null}
          <CardTitle className="truncate text-sm md:text-base font-bold text-slate-900">
            {title}
          </CardTitle>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      <CardContent className={cn("p-4 flex-1 flex flex-col justify-between", contentClassName)}>{children}</CardContent>
    </Card>
  )
}

interface MetricTileProps {
  label: string
  value: ReactNode
  subtext?: ReactNode
  tone?: "positive" | "negative" | "neutral" | "accent" | "amber"
  className?: string
}

const tileTone = {
  positive: "border-green-200 bg-green-50/50 text-green-800",
  negative: "border-red-200 bg-red-50/50 text-red-800",
  neutral: "border-slate-200 bg-slate-50 text-slate-800",
  accent: "border-cyan-200 bg-cyan-50/50 text-cyan-900",
  amber: "border-amber-200 bg-amber-50/50 text-amber-800",
}

export function MetricTile({ label, value, subtext, tone = "neutral", className }: MetricTileProps) {
  return (
    <div className={cn("rounded-lg border px-3.5 py-2.5 transition-all", tileTone[tone], className)}>
      <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{label}</p>
      <p className="truncate font-bold font-mono text-lg md:text-xl text-slate-900 tracking-tight leading-none">
        {value}
      </p>
      {subtext ? <p className="text-[11px] text-slate-500 mt-1 font-normal">{subtext}</p> : null}
    </div>
  )
}
