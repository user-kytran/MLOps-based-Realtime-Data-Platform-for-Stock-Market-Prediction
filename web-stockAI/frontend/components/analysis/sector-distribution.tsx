"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { useStocksRealtimeWS } from "@/hooks/useStocksRealtimeWS"
import { AnalysisPanel, sectorPalette, tooltipStyle } from "./analysis-ui"

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
};

const COLORS = sectorPalette

export function SectorDistribution() {
  const stocks = useStocksRealtimeWS()

  const sectorData = Object.entries(SECTOR_SYMBOLS).map(([name, symbols]) => {
    const sectorStocks = stocks.filter(s => symbols.includes(s.symbol))
    const totalVolume = sectorStocks.reduce((sum, s) => sum + (s.match.volume || 0), 0)
    return { name, value: totalVolume, count: sectorStocks.length }
  }).filter(d => d.value > 0)

  return (
    <AnalysisPanel title="Sector Distribution" eyebrow="Volume mix" contentClassName="space-y-3">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={sectorData}
              cx="50%"
              cy="50%"
              labelLine={false}
              innerRadius={58}
              outerRadius={98}
              fill="#8884d8"
              dataKey="value"
            >
              {sectorData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={tooltipStyle}
              labelStyle={{ color: '#0f172a' }}
              itemStyle={{ color: '#334155' }}
              formatter={(value: number, name: string) => {
                const total = sectorData.reduce((sum, item) => sum + item.value, 0)
                const percentage = ((value / total) * 100).toFixed(1)
                return [`${(value / 1000000).toFixed(2)}M (${percentage}%)`, name.replace(/_/g, ' ')]
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {sectorData.map((entry, index) => {
            const total = sectorData.reduce((sum, item) => sum + item.value, 0)
            const percent = total ? (entry.value / total) * 100 : 0
            return (
              <div key={entry.name} className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-[11px]">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="truncate font-semibold text-slate-700">{entry.name.replace(/_/g, ' ')}</span>
                </div>
                <span className="shrink-0 font-mono font-bold text-slate-600">{percent.toFixed(1)}%</span>
              </div>
            )
          })}
        </div>
    </AnalysisPanel>
  )
}
