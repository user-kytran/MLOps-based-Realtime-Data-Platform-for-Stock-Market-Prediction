"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from "recharts"
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

const COLORS: Record<string, string> = {
  Banking: '#60A5FA',
  Insurance: '#34D399',
  Securities: '#FBBF24',
  Real_Estate: '#F87171',
  Technology: '#A78BFA',
  Materials: '#FB923C',
  Energy: '#22D3EE',
  Transport: '#C084FC',
  Consumer: '#4ADE80',
  Healthcare: '#FACC15',
  Industrial: '#F472B6',
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
    <Card className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-gray-900 text-xl">Sector Stock Trends</CardTitle>
          <div className="flex gap-2">
            <select 
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="bg-white text-gray-900 border border-gray-300 rounded px-3 py-1 text-sm"
            >
              {Object.keys(SECTOR_SYMBOLS).map(sector => (
                <option key={sector} value={sector}>{sector.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <select 
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as 'percentage' | 'price')}
              className="bg-white text-gray-900 border border-gray-300 rounded px-3 py-1 text-sm"
            >
              <option value="percentage">% Change</option>
              <option value="price">Price</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={stockData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
            <XAxis 
              dataKey="symbol" 
              stroke="#6b7280"
              style={{ fontSize: '11px' }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              stroke="#6b7280"
              style={{ fontSize: '11px' }}
              tickFormatter={(value) => 
                viewMode === 'percentage' 
                  ? `${value.toFixed(1)}%` 
                  : `${(value / 1000).toFixed(0)}K`
              }
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #d1d5db', color: '#374151', fontSize: '12px', fontWeight: 'bold' }}
              labelStyle={{ color: '#374151' }}
              itemStyle={{ color: '#374151' }}
              formatter={(value: number) => [
                viewMode === 'percentage' 
                  ? `${value.toFixed(2)}%` 
                  : `${value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} VND`,
                viewMode === 'percentage' ? 'Change' : 'Price'
              ]}
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="#06b6d4" 
              strokeWidth={2}
              dot={{ fill: '#06b6d4', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

