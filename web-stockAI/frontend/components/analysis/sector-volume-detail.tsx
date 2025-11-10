"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, CartesianGrid } from "recharts"
import { useStocksRealtimeWS } from "@/hooks/useStocksRealtimeWS"
import { useState } from "react"

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

const COLORS = ['#0d4d4d', '#116666', '#157a7a', '#1a8f8f', '#1fa3a3', '#24b8b8', '#29cccc', '#47d9d9', '#66e0e0', '#85e6e6', '#a3ecec', '#c2f2f2', '#e0f9f9', '#f0fcfc', '#f7fefe']

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
    <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-gray-900 text-xl">Sector Volume Detail</CardTitle>
          <select 
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="bg-white text-gray-900 border border-gray-300 rounded px-3 py-1 text-sm"
          >
            {Object.keys(SECTOR_SYMBOLS).map(sector => (
              <option key={sector} value={sector}>{sector.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={sectorStocks}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
            <XAxis 
              dataKey="symbol" 
              stroke="#6b7280"
              style={{ fontSize: '11px' }}
            />
            <YAxis 
              stroke="#6b7280"
              style={{ fontSize: '11px' }}
              tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #d1d5db', color: '#374151', fontSize: '12px', fontWeight: 'bold' }}
              labelStyle={{ color: '#374151' }}
              itemStyle={{ color: '#374151' }}
              formatter={(value: number) => [`${(value / 1000000).toFixed(2)}M`, 'Volume']}
              cursor={{ fill: 'rgba(6, 182, 212, 0.1)' }}
            />
            <Bar dataKey="volume" radius={[4, 4, 0, 0]}>
              {sectorStocks.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

