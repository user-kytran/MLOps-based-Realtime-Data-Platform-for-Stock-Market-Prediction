"use client"

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, CartesianGrid } from "recharts"
import { useStocksRealtimeWS } from "@/hooks/useStocksRealtimeWS"
import { useState } from "react"
import { AnalysisPanel, axisTick, chartColors, tooltipStyle } from "./analysis-ui"

const SECTOR_SYMBOLS: Record<string, string[]> = {
  Financial_Services: ['ACB','AGR','APG','BIC','BID','BMI','BSI','BVH','CTG','CTS','DSC','DSE','EIB','EVF','FIT','FTS','HCM','HDB','LPB','MBB','MIG','MSB','NAB','OCB','ORS','SHB','SSB','SSI','STB','TCB','TCI','TPB','TVS','VCB','VCI','VDS','VIB','VIX','VND','VPB'],
  Real_Estate: ['AGG','ASM','BCM','CCL','CRE','DIG','DTA','DXG','DXS','FIR','HAG','HAR','HDC','HDG','HPX','HQC','ITC','KBC','KDH','KHG','KOS','LHG','NBB','NLG','PDR','SCR','SGR','SIP','SJS','SZC','SZL','TEG','UIC','VHM','VIC','VPH','VPI','VRE'],
  Industrials: ['AST','BCE','BMP','BRC','BWE','CDC','CII','CLL','CRC','CTD','CTR','D2D','DC4','DHM','DPG','DVP','FCN','GEE','GEX','GMD','HAH','HCD','HHS','HHV','HID','HMC','HTI','HUB','IJC','ILB','LCG','MHC','MSN','NCT','NHA','NO1','NTL','OGC','PAC','PC1','PHC','PIT','PTB','PTC','PTL','PVP','PVT','RAL','REE','SAM','SBG','SCS','SGN','SKG','TCH','TCL','TCO','TIP','TLD','TLG','TV2','TYA','VCG','VGC','VIP','VJC','VNL','VNS','VOS','VPG','VRC','VSC','VTO','VTP'],
  Basic_Materials: ['ABS','ACC','ADP','APH','BFC','BKG','BMC','C32','CSV','CTI','DCM','DGC','DHA','DHC','DPM','FCM','HAP','HHP','HII','HPG','HSG','HT1','KSB','LBM','NHH','NKG','NNC','PLP','QCG','RYG','SFG','SHI','TDC','THG','TLH','TNI','TNT','TRC','VCA','VFG','YBM'],
  Consumer_Cyclical: ['AAA','ADS','CSM','CTF','DAH','DPR','DRC','DSN','EVE','FRT','GDT','GIL','GVR','HAX','HTG','HTN','HVH','KMR','MCP','MSH','MWG','PNJ','SAV','SFC','ST8','STK','TCM','TCT','TDP','TMT','TTF'],
  Consumer_Defensive: ['AAM','ABT','ACL','ANV','BAF','CLC','CMX','DBC','FMC','HSL','IDI','KDC','LAF','LIX','LSS','MCM','NAF','NSC','PAN','PHR','SAB','SBT','SMB','SVT','TSC','VHC','VNM'],
  Technology: ['CMG','DGW','ELC','FPT','ITD','SGT'],
  Utilities: ['ASP','BTP','CNG','DRL','GSP','KHP','NT2','POW','PPC','SJD','TDG','TTA'],
  Energy: ['GAS','PET','PGC','PLX','PVD'],
  Healthcare: ['DBD','DBT','DCL','DMC','IMP','JVC','TNH','VMD'],
  Communication_Services: ['ADG','ICT','YEG'],
}

export function SectorVolumeDetail() {
  const stocks = useStocksRealtimeWS()
  const [selectedSector, setSelectedSector] = useState("Financial_Services")

  const sectorStocks = stocks
    .filter((s) => SECTOR_SYMBOLS[selectedSector]?.includes(s.symbol) && s.match?.volume != null)
    .map((s) => ({
      symbol: s.symbol,
      volume: Math.round(((s.match?.volume || 0) / 1_000_000) * 100) / 100,
      change: s.match?.change || 0,
    }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 10)

  return (
    <AnalysisPanel
      title="Sector Volume Detail"
      eyebrow="Selected sector liquidity"
      action={
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
      }
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={sectorStocks} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 6 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} horizontal={false} />
          <XAxis
            type="number"
            stroke={chartColors.axis}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}M`}
          />
          <YAxis
            dataKey="symbol"
            type="category"
            stroke={chartColors.axis}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number, name: string, props: any) => [
              `${value.toFixed(2)}M shares (${props.payload.change >= 0 ? "+" : ""}${props.payload.change})`,
              "Volume",
            ]}
            cursor={{ fill: "rgba(15, 23, 42, 0.03)" }}
          />
          <Bar dataKey="volume" radius={[0, 4, 4, 0]} barSize={14}>
            {sectorStocks.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.change > 0 ? "#16a34a" : entry.change < 0 ? "#dc2626" : "#64748b"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </AnalysisPanel>
  )
}
