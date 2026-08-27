"use client"

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell } from "recharts"
import { useStocksRealtimeWS } from "@/hooks/useStocksRealtimeWS"
import { useState } from "react"
import { AnalysisPanel, axisTick, chartColors, tooltipStyle } from "./analysis-ui"

const SECTOR_SYMBOLS: Record<string, string[]> = {
  Consumer_Cyclical: ['AAA','ADS','CSM','CTF','DAH','DPR','DRC','DSN','EVE','FRT','GDT','GIL','GVR','HAX','HTG','HTN','HVH','KMR','MCP','MSH','MWG','PNJ','SAV','SFC','ST8','STK','TCM','TCT','TDP','TMT','TTF'],
  Consumer_Defensive: ['AAM','ABT','ACL','ANV','BAF','CLC','CMX','DBC','FMC','HSL','IDI','KDC','LAF','LIX','LSS','MCM','NAF','NSC','PAN','PHR','SAB','SBT','SMB','SVT','TSC','VHC','VNM'],
  Basic_Materials: ['ABS','ACC','ADP','APH','BFC','BKG','BMC','C32','CSV','CTI','DCM','DGC','DHA','DHC','DPM','FCM','HAP','HHP','HII','HPG','HSG','HT1','KSB','LBM','NHH','NKG','NNC','PLP','QCG','RYG','SFG','SHI','TDC','THG','TLH','TNI','TNT','TRC','VCA','VFG','YBM'],
  Financial_Services: ['ACB','AGR','APG','BIC','BID','BMI','BSI','BVH','CTG','CTS','DSC','DSE','EIB','EVF','FIT','FTS','HCM','HDB','LPB','MBB','MIG','MSB','NAB','OCB','ORS','SHB','SSB','SSI','STB','TCB','TCI','TPB','TVS','VCB','VCI','VDS','VIB','VIX','VND','VPB'],
  Communication_Services: ['ADG','ICT','YEG'],
  Real_Estate: ['AGG','ASM','BCM','CCL','CRE','DIG','DTA','DXG','DXS','FIR','HAG','HAR','HDC','HDG','HPX','HQC','ITC','KBC','KDH','KHG','KOS','LHG','NBB','NLG','PDR','SCR','SGR','SIP','SJS','SZC','SZL','TEG','UIC','VHM','VIC','VPH','VPI','VRE'],
  Utilities: ['ASP','BTP','CNG','DRL','GSP','KHP','NT2','POW','PPC','SJD','TDG','TTA'],
  Industrials: ['AST','BCE','BMP','BRC','BWE','CDC','CII','CLL','CRC','CTD','CTR','D2D','DC4','DHM','DPG','DVP','FCN','GEE','GEX','GMD','HAH','HCD','HHS','HHV','HID','HMC','HTI','HUB','IJC','ILB','LCG','MHC','MSN','NCT','NHA','NO1','NTL','OGC','PAC','PC1','PHC','PIT','PTB','PTC','PTL','PVP','PVT','RAL','REE','SAM','SBG','SCS','SGN','SKG','TCH','TCL','TCO','TIP','TLD','TLG','TV2','TYA','VCG','VGC','VIP','VJC','VNL','VNS','VOS','VPG','VRC','VSC','VTO','VTP'],
  Technology: ['CMG','DGW','ELC','FPT','ITD','SGT'],
  Healthcare: ['DBD','DBT','DCL','DMC','IMP','JVC','TNH','VMD'],
  Energy: ['GAS','PET','PGC','PLX','PVD'],
}

export function SectorPriceTrend() {
  const stocks = useStocksRealtimeWS()
  const [viewMode, setViewMode] = useState<'percentage' | 'price'>('price')
  const [selectedSector, setSelectedSector] = useState("Financial_Services")

  const stockData = stocks
    .filter(s => SECTOR_SYMBOLS[selectedSector]?.includes(s.symbol) && s.match.price != null)
    .map(s => {
      if (viewMode === 'percentage') {
        const change = s.reference > 0 ? ((s.match.price - s.reference) / s.reference) * 100 : 0
        return { symbol: s.symbol, value: change }
      } else {
        return { symbol: s.symbol, value: s.match.price }
      }
    })
    .sort((a, b) => b.value - a.value)

  return (
    <AnalysisPanel
      title="Sector Stock Snapshot"
      eyebrow="Price and performance"
      action={
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="min-w-0 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-sm"
            >
              {Object.keys(SECTOR_SYMBOLS).map(sector => (
                <option key={sector} value={sector}>{sector.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as 'percentage' | 'price')}
              className="min-w-0 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-sm"
            >
              <option value="percentage">% Change</option>
              <option value="price">Price</option>
            </select>
          </div>
      }
    >
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={stockData} margin={{ top: 4, right: 14, bottom: 18, left: 0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke={chartColors.grid} vertical={false} />
            <XAxis 
              dataKey="symbol" 
              stroke={chartColors.axis}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              angle={-45}
              textAnchor="end"
              height={72}
            />
            <YAxis 
              stroke={chartColors.axis}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => 
                viewMode === 'percentage' 
                  ? `${value.toFixed(1)}%` 
                  : `${(value / 1000).toFixed(0)}K`
              }
            />
            <Tooltip 
              contentStyle={tooltipStyle}
              labelStyle={{ color: '#0f172a' }}
              itemStyle={{ color: '#334155' }}
              formatter={(value: number) => [
                viewMode === 'percentage' 
                  ? `${value.toFixed(2)}%` 
                  : `${value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} VND`,
                viewMode === 'percentage' ? 'Change' : 'Price'
              ]}
              cursor={{ fill: 'rgba(15, 118, 110, 0.08)' }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={20}>
              {stockData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={viewMode === "percentage" && entry.value < 0 ? chartColors.negative : chartColors.accent}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
    </AnalysisPanel>
  )
}
