"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { useStocksRealtimeWS } from "@/hooks/useStocksRealtimeWS"
import { AnalysisPanel, sectorPalette, tooltipStyle } from "./analysis-ui"

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

const COLORS = sectorPalette

export function SectorDistribution() {
  const stocks = useStocksRealtimeWS()

  let totalMarketVolume = 0
  const sectorData = Object.entries(SECTOR_SYMBOLS).map(([key, symbols], index) => {
    const sectorStocks = stocks.filter(s => symbols.includes(s.symbol))
    const totalVolume = sectorStocks.reduce((sum, s) => sum + (s.match?.volume || 0), 0)
    totalMarketVolume += totalVolume
    const name = key.replace(/_/g, ' ')
    return {
      key,
      name,
      value: totalVolume,
      count: sectorStocks.length,
      color: COLORS[index % COLORS.length]
    }
  }).filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)

  return (
    <AnalysisPanel
      title="Sector Distribution"
      eyebrow="Volume mix"
      action={
        <span className="inline-flex items-center text-xs font-semibold text-cyan-800 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-md">
          Volume Share
        </span>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Left: Clean Donut Chart */}
        <div className="relative h-[220px] w-full md:col-span-5 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sectorData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {sectorData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={tooltipStyle}
                formatter={(value: number, name: string) => {
                  const percentage = totalMarketVolume > 0 ? ((value / totalMarketVolume) * 100).toFixed(1) : 0
                  return [`${(value / 1_000_000).toFixed(2)}M shares (${percentage}%)`, name]
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-bold text-slate-800">{sectorData.length}</span>
            <span className="text-[11px] text-slate-500 font-semibold">Sectors</span>
          </div>
        </div>

        {/* Right: Clean, High-readability Sector List */}
        <div className="md:col-span-7 space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
          {sectorData.map((entry) => {
            const percent = totalMarketVolume > 0 ? (entry.value / totalMarketVolume) * 100 : 0
            return (
              <div
                key={entry.key}
                className="flex items-center justify-between gap-2 p-1.5 rounded-md hover:bg-slate-50 transition-colors text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="font-semibold text-slate-800 truncate" title={entry.name}>
                    {entry.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-slate-400 text-[11px]">
                    {(entry.value / 1_000_000).toFixed(1)}M
                  </span>
                  <span className="font-bold text-slate-700 font-mono w-12 text-right">
                    {percent.toFixed(1)}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </AnalysisPanel>
  )
}
