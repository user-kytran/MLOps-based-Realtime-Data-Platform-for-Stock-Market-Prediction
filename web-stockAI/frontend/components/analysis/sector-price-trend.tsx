"use client"

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell } from "recharts"
import { useStocksRealtimeWS } from "@/hooks/useStocksRealtimeWS"
import { useState } from "react"
import { AnalysisPanel, axisTick, chartColors, tooltipStyle } from "./analysis-ui"

const SECTOR_SYMBOLS: Record<string, string[]> = {
  Financial_Services: ['ACB','AGR','APG','BIC','BID','BMI','BSI','BVH','CTG','CTS','DSC','DSE','EIB','EVF','FIT','FTS','HCM','HDB','LPB','MBB','MIG','MSB','NAB','OCB','ORS','SHB','SSB','SSI','STB','TCB','TCI','TPB','TVS','VCB','VCI','VDS','VIB','VIX','VND','VPB'],
  Real_Estate: ['AGG','ASM','BCM','CCL','CRE','DIG','DTA','DXG','DXS','FIR','HAG','HAR','HDC','HDG','HPX','HQC','ITC','KBC','KDH','KHG','KOS','LHG','NBB','NLG','PDR','SCR','SGR','SIP','SJS','SZC','SZL','TEG','UIC','VHM','VIC','VPH','VPI','VRE'],
  Basic_Materials: ['ABS','ACC','ADP','APH','BFC','BKG','BMC','C32','CSV','CTI','DCM','DGC','DHA','DHC','DPM','FCM','HAP','HHP','HII','HPG','HSG','HT1','KSB','LBM','NHH','NKG','NNC','PLP','QCG','RYG','SFG','SHI','TDC','THG','TLH','TNI','TNT','TRC','VCA','VFG','YBM'],
  Industrials: ['AST','BCE','BMP','BRC','BWE','CDC','CII','CLL','CRC','CTD','CTR','D2D','DC4','DHM','DPG','DVP','FCN','GEE','GEX','GMD','HAH','HCD','HHS','HHV','HID','HMC','HTI','HUB','IJC','ILB','LCG','MHC','MSN','NCT','NHA','NO1','NTL','OGC','PAC','PC1','PHC','PIT','PTB','PTC','PTL','PVP','PVT','RAL','REE','SAM','SBG','SCS','SGN','SKG','TCH','TCL','TCO','TIP','TLD','TLG','TV2','TYA','VCG','VGC','VIP','VJC','VNL','VNS','VOS','VPG','VRC','VSC','VTO','VTP'],
  Technology: ['CMG','DGW','ELC','FPT','ITD','SGT'],
  Consumer_Cyclical: ['AAA','ADS','CSM','CTF','DAH','DPR','DRC','DSN','EVE','FRT','GDT','GIL','GVR','HAX','HTG','HTN','HVH','KMR','MCP','MSH','MWG','PNJ','SAV','SFC','ST8','STK','TCM','TCT','TDP','TMT','TTF'],
  Consumer_Defensive: ['AAM','ABT','ACL','ANV','BAF','CLC','CMX','DBC','FMC','HSL','IDI','KDC','LAF','LIX','LSS','MCM','NAF','NSC','PAN','PHR','SAB','SBT','SMB','SVT','TSC','VHC','VNM'],
  Energy: ['GAS','PET','PGC','PLX','PVD'],
  Utilities: ['ASP','BTP','CNG','DRL','GSP','KHP','NT2','POW','PPC','SJD','TDG','TTA'],
  Healthcare: ['DBD','DBT','DCL','DMC','IMP','JVC','TNH','VMD'],
  Communication_Services: ['ADG','ICT','YEG'],
}

export function SectorPriceTrend() {
  const stocks = useStocksRealtimeWS()
  const [viewMode, setViewMode] = useState<"percentage" | "price">("percentage")
  const [selectedSector, setSelectedSector] = useState("Financial_Services")

  // Filter sector components and select top 16 active components so the chart stays clean and legible
  const stockData = stocks
    .filter((s) => SECTOR_SYMBOLS[selectedSector]?.includes(s.symbol) && s.match?.price != null)
    .sort((a, b) => (b.match?.volume || 0) - (a.match?.volume || 0))
    .slice(0, 16)
    .map((s) => {
      if (viewMode === "percentage") {
        const change = s.reference > 0 ? ((s.match.price - s.reference) / s.reference) * 100 : 0
        return { symbol: s.symbol, value: Math.round(change * 100) / 100, volume: s.match?.volume || 0 }
      } else {
        return { symbol: s.symbol, value: s.match.price, volume: s.match?.volume || 0 }
      }
    })
    .sort((a, b) => b.value - a.value)

  return (
    <AnalysisPanel
      title="Sector Stock Snapshot"
      eyebrow="Price and performance"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 focus:border-cyan-500 focus:outline-none cursor-pointer shadow-2xs"
          >
            {Object.keys(SECTOR_SYMBOLS).map((sector) => (
              <option key={sector} value={sector}>
                {sector.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <div className="flex border border-slate-200 rounded-lg bg-slate-50 p-0.5 text-xs">
            <button
              onClick={() => setViewMode("percentage")}
              className={`px-2.5 py-1 font-semibold rounded-md transition-colors ${
                viewMode === "percentage" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              % Change
            </button>
            <button
              onClick={() => setViewMode("price")}
              className={`px-2.5 py-1 font-semibold rounded-md transition-colors ${
                viewMode === "price" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Price
            </button>
          </div>
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={stockData} margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
          <XAxis
            dataKey="symbol"
            stroke={chartColors.axis}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            angle={-30}
            textAnchor="end"
            height={40}
          />
          <YAxis
            stroke={chartColors.axis}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) =>
              viewMode === "percentage"
                ? `${value.toFixed(1)}%`
                : `${(value / 1000).toFixed(0)}k`
            }
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number) => [
              viewMode === "percentage"
                ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
                : `${value.toLocaleString("vi-VN")} VND`,
              viewMode === "percentage" ? "Change" : "Match Price",
            ]}
            cursor={{ fill: "rgba(15, 23, 42, 0.03)" }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={20}>
            {stockData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={viewMode === "percentage" ? (entry.value >= 0 ? "#16a34a" : "#dc2626") : "#0891b2"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </AnalysisPanel>
  )
}
