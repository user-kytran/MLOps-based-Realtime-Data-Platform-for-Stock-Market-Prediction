"use client"

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, CartesianGrid } from "recharts"
import { useStocksRealtimeWS } from "@/hooks/useStocksRealtimeWS"
import { useState } from "react"
import { AnalysisPanel, axisTick, chartColors, sectorPalette, tooltipStyle } from "./analysis-ui"

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

const COLORS = sectorPalette

export function SectorVolumeDetail() {
  const stocks = useStocksRealtimeWS()
  const [selectedSector, setSelectedSector] = useState("Financial_Services")

  const sectorStocks = stocks
    .filter(s => SECTOR_SYMBOLS[selectedSector]?.includes(s.symbol) && s.match.volume != null)
    .map(s => ({
      symbol: s.symbol,
      volume: s.match.volume || 0
    }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 15)

  return (
    <AnalysisPanel
      title="Sector Volume Detail"
      eyebrow="Selected sector"
      action={
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="min-w-0 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-sm"
          >
            {Object.keys(SECTOR_SYMBOLS).map(sector => (
              <option key={sector} value={sector}>{sector.replace(/_/g, ' ')}</option>
            ))}
          </select>
      }
    >
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={sectorStocks} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke={chartColors.grid} vertical={false} />
            <XAxis 
              dataKey="symbol" 
              stroke={chartColors.axis}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke={chartColors.axis}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
            />
            <Tooltip 
              contentStyle={tooltipStyle}
              labelStyle={{ color: '#0f172a' }}
              itemStyle={{ color: '#334155' }}
              formatter={(value: number) => [`${(value / 1000000).toFixed(2)}M`, 'Volume']}
              cursor={{ fill: 'rgba(15, 118, 110, 0.08)' }}
            />
            <Bar dataKey="volume" radius={[6, 6, 0, 0]} barSize={24}>
              {sectorStocks.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
    </AnalysisPanel>
  )
}
