"use client"

import { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export const chartColors = {
  positive: "#059669",
  negative: "#dc2626",
  neutral: "#64748b",
  accent: "#0f766e",
  amber: "#d97706",
  grid: "#e2e8f0",
  axis: "#64748b",
}

export const sectorPalette = [
  "#0f766e",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#dc2626",
  "#d97706",
  "#65a30d",
  "#0891b2",
  "#4f46e5",
  "#475569",
]

export const tooltipStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.12)",
  color: "#0f172a",
  fontSize: "12px",
  fontWeight: 600,
}

export const axisTick = {
  fill: chartColors.axis,
  fontSize: 11,
  fontWeight: 600,
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
    <Card className={cn("gap-0 rounded-lg border-slate-200 bg-white shadow-sm", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {eyebrow}
            </p>
          ) : null}
          <CardTitle className="truncate text-sm font-bold text-slate-950">{title}</CardTitle>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      <CardContent className={cn("px-4 py-4", contentClassName)}>{children}</CardContent>
    </Card>
  )
}

interface MetricTileProps {
  label: string
  value: ReactNode
  icon?: ReactNode
  tone?: "positive" | "negative" | "neutral" | "accent" | "amber"
}

const tileTone = {
  positive: "border-emerald-200 bg-emerald-50 text-emerald-700",
  negative: "border-red-200 bg-red-50 text-red-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  accent: "border-teal-200 bg-teal-50 text-teal-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
}

export function MetricTile({ label, value, icon, tone = "neutral" }: MetricTileProps) {
  return (
    <div className={cn("rounded-lg border px-3 py-3", tileTone[tone])}>
      <div className="mb-2 flex items-center justify-between gap-2 text-slate-600">
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.04em]">{label}</p>
        {icon ? <div className="shrink-0">{icon}</div> : null}
      </div>
      <p className="truncate font-mono text-xl font-bold leading-none">{value}</p>
    </div>
  )
}
