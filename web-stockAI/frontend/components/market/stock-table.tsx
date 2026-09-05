"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Icons } from "@/components/icons"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useStocksRealtimeWS } from "@/hooks/useStocksRealtimeWS"
import { PredictionCell } from "@/components/market/PredictionCell"
import { usePredictions } from "@/hooks/usePredictions"

const VN30_LIST = [
  "ACB","BCM","BID","CTG","DGC","FPT","GAS","GVR","HDB","HPG",
  "LPB","MBB","MSN","MWG","PLX","SAB","SHB","SSB","SSI","STB",
  "TCB","TPB","VCB","VHM","VIB","VIC","VJC","VNM","VPB","VRE",
];

const SECTOR_SYMBOLS: Record<string, string[]> = {
  "Consumer_Cyclical": ['AAA','ADS','CSM','CTF','DAH','DPR','DRC','DSN','EVE','FRT','GDT','GIL','GVR','HAX','HTG','HTN','HVH','KMR','MCP','MSH','MWG','PNJ','SAV','SFC','ST8','STK','TCM','TCT','TDP','TMT','TTF'],
  "Consumer_Defensive": ['AAM','ABT','ACL','ANV','BAF','CLC','CMX','DBC','FMC','HSL','IDI','KDC','LAF','LIX','LSS','MCM','NAF','NSC','PAN','PHR','SAB','SBT','SMB','SVT','TSC','VHC','VNM'],
  "Basic_Materials": ['ABS','ACC','ADP','APH','BFC','BKG','BMC','C32','CSV','CTI','DCM','DGC','DHA','DHC','DPM','FCM','HAP','HHP','HII','HPG','HSG','HT1','KSB','LBM','NHH','NKG','NNC','PLP','QCG','RYG','SFG','SHI','TDC','THG','TLH','TNI','TNT','TRC','VCA','VFG','YBM'],
  "Financial_Services": ['ACB','AGR','APG','BIC','BID','BMI','BSI','BVH','CTG','CTS','DSC','DSE','EIB','EVF','FIT','FTS','HCM','HDB','LPB','MBB','MIG','MSB','NAB','OCB','ORS','SHB','SSB','SSI','STB','TCB','TCI','TPB','TVS','VCB','VCI','VDS','VIB','VIX','VND','VPB'],
  "Communication_Services": ['ADG','ICT','YEG'],
  "Real_Estate": ['AGG','ASM','BCM','CCL','CRE','DIG','DTA','DXG','DXS','FIR','HAG','HAR','HDC','HDG','HPX','HQC','ITC','KBC','KDH','KHG','KOS','LHG','NBB','NLG','PDR','SCR','SGR','SIP','SJS','SZC','SZL','TEG','UIC','VHM','VIC','VPH','VPI','VRE'],
  "Utilities": ['ASP','BTP','CNG','DRL','GSP','KHP','NT2','POW','PPC','SJD','TDG','TTA'],
  "Industrials": ['AST','BCE','BMP','BRC','BWE','CDC','CII','CLL','CRC','CTD','CTR','D2D','DC4','DHM','DPG','DVP','FCN','GEE','GEX','GMD','HAH','HCD','HHS','HHV','HID','HMC','HTI','HUB','IJC','ILB','LCG','MHC','MSN','NCT','NHA','NO1','NTL','OGC','PAC','PC1','PHC','PIT','PTB','PTC','PTL','PVP','PVT','RAL','REE','SAM','SBG','SCS','SGN','SKG','TCH','TCL','TCO','TIP','TLD','TLG','TV2','TYA','VCG','VGC','VIP','VJC','VNL','VNS','VOS','VPG','VRC','VSC','VTO','VTP'],
  "Technology": ['CMG','DGW','ELC','FPT','ITD','SGT'],
  "Healthcare": ['DBD','DBT','DCL','DMC','IMP','JVC','TNH','VMD'],
  "Energy": ['GAS','PET','PGC','PLX','PVD']
};

function formatVolume(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M"
  if (v >= 1_000) return Math.round(v / 1_000) + "K"
  return v.toString()
}

function flashCellClass(direction?: "up" | "down") {
  if (direction === "up") return "bg-green-600 text-white"
  if (direction === "down") return "bg-red-600 text-white"
  return "bg-gray-100"
}

export function StockTable({ mode = "VN30" as "ALL" | "VN30", sector = "all" as string }) {
  const stocks = useStocksRealtimeWS();
  const predictions = usePredictions();
  const prevStocksRef = useRef<Record<string, any>>({});
  const clearTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [flashMap, setFlashMap] = useState<Record<string, {
    price?: "up" | "down"
    volume?: "up" | "down"
    change?: "up" | "down"
    change_percent?: "up" | "down"
  }>>({});
  const [dirMap, setDirMap] = useState<Record<string, {
    price?: "up" | "down"
    volume?: "up" | "down"
    change?: "up" | "down"
    change_percent?: "up" | "down"
  }>>({});

  useEffect(() => {
    if (!stocks || stocks.length === 0) return;
    const next: Record<string, any> = {};
    const flashes: typeof flashMap = {};
    const nextDir: typeof dirMap = { ...dirMap };
    
    for (const s of stocks) {
      const prev = prevStocksRef.current[s.symbol];
      next[s.symbol] = s;
      if (!prev) continue;
      
      const f: any = {};
      
      if (s.match.price !== null && prev.match.price !== null && s.match.price !== prev.match.price) {
        const dir = s.match.price > prev.match.price ? "up" : "down" as const;
        f.price = dir; 
        (nextDir[s.symbol] ||= {}).price = dir;
      }
      
      if (s.match.volume !== null && prev.match.volume !== null && s.match.volume !== prev.match.volume) {
        const dir = s.match.volume > prev.match.volume ? "up" : "down" as const;
        f.volume = dir; 
        (nextDir[s.symbol] ||= {}).volume = dir;
      }
      
      const currentDisplayChange = s.lastChange ?? s.match.change;
      const prevDisplayChange = prev.lastChange ?? prev.match.change;
      if (currentDisplayChange !== null && prevDisplayChange !== null && currentDisplayChange !== prevDisplayChange) {
        const dir = currentDisplayChange > prevDisplayChange ? "up" : "down" as const;
        f.change = dir; 
        (nextDir[s.symbol] ||= {}).change = dir;
      }
      
      const currentDisplayChangePercent = s.lastChangePercent ?? s.match.change_percent;
      const prevDisplayChangePercent = prev.lastChangePercent ?? prev.match.change_percent;
      if (currentDisplayChangePercent !== null && prevDisplayChangePercent !== null && currentDisplayChangePercent !== prevDisplayChangePercent) {
        const dir = currentDisplayChangePercent > prevDisplayChangePercent ? "up" : "down" as const;
        f.change_percent = dir; 
        (nextDir[s.symbol] ||= {}).change_percent = dir;
      }
      
      if (Object.keys(f).length) flashes[s.symbol] = f;
    }
    
    if (Object.keys(flashes).length) {
      setFlashMap(flashes);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => setFlashMap({}), 600);
    }
    
    if (Object.keys(nextDir).length) setDirMap(nextDir);
    prevStocksRef.current = next;
    
    return () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
    }
  }, [stocks]);

  const filteredStocks = (() => {
    let list = stocks;
    if (mode === "VN30") list = list.filter(s => VN30_LIST.includes(s.symbol));
    if (sector !== "all") {
      const symbols = SECTOR_SYMBOLS[sector] || [];
      list = list.filter(s => symbols.includes(s.symbol));
    }
    return list;
  })();

  return (
    <Card className="bg-white/95 backdrop-blur-md border-0 shadow-lg rounded-xl overflow-hidden !py-0 !gap-0">
      <CardHeader className="place-items-center bg-white text-cyan-700 !py-1.5 !px-2">
        <CardTitle className="flex w-full items-center justify-center text-[15.5px] font-bold tracking-wide">
          {mode === "VN30" ? "VN30 STOCKS" : "ALL STOCKS"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-y-auto max-h-[80vh]">
          <table className="table-fixed w-full border-separate border-spacing-0 text-[11px] bg-white text-gray-900">
            <colgroup>
              <col className="w-[62px]" />
              <col className="w-[66px]" />
              <col className="w-[66px]" />
              <col className="w-[72px]" />
              <col className="w-[68px]" />
              <col className="w-[72px]" />
              <col className="w-[52px]" />
              <col className="w-[58px]" />
              <col className="w-[66px]" />
              <col className="w-[66px]" />
              <col className="w-[58px]" />
            </colgroup>
            <thead className="sticky top-0 z-20 bg-gray-200 shadow-sm">
              <tr>
                <th rowSpan={2} className="text-gray-800 text-center py-1 px-0.5 font-bold text-[11px] border border-gray-300 bg-gray-200 whitespace-nowrap">
                  <span className="inline-block text-left min-w-[38px]">STOCK</span>
                </th>
                <th rowSpan={2} className="text-gray-800 text-center py-1 px-0.5 font-bold text-[11px] border border-gray-300 bg-gray-200 whitespace-nowrap">
                  <span className="inline-block text-left min-w-[46px]">CEIL</span>
                </th>
                <th rowSpan={2} className="text-gray-800 text-center py-1 px-0.5 font-bold text-[11px] border border-gray-300 bg-gray-200 whitespace-nowrap">
                  <span className="inline-block text-left min-w-[46px]">FLOOR</span>
                </th>
                <th rowSpan={2} className="text-gray-800 text-center py-1 px-0.5 font-bold text-[11px] border border-gray-300 bg-gray-200 whitespace-nowrap">
                  <span className="inline-block text-left min-w-[46px]">REF</span>
                </th>
                <th colSpan={4} className="text-gray-800 text-center py-1 px-0.5 font-bold text-[11px] border border-gray-300 bg-gray-200 whitespace-nowrap">MATCH</th>
                <th rowSpan={2} className="text-gray-800 text-center py-1 px-0.5 font-bold text-[11px] border border-gray-300 bg-gray-200 whitespace-nowrap">
                  <span className="inline-block text-left min-w-[46px]">HIGH</span>
                </th>
                <th rowSpan={2} className="text-gray-800 text-center py-1 px-0.5 font-bold text-[11px] border border-gray-300 bg-gray-200 whitespace-nowrap">
                  <span className="inline-block text-left min-w-[46px]">LOW</span>
                </th>
                <th rowSpan={2} className="text-gray-800 text-center py-1 px-0.5 font-bold text-[10px] border border-gray-300 bg-gray-200 whitespace-nowrap">PREDICT</th>
              </tr>
              <tr>
                <th className="text-gray-700 text-center py-1 px-0.5 font-bold text-[11px] border border-gray-300 bg-gray-200 whitespace-nowrap">
                  <span className="inline-block text-left min-w-[46px]">PRICE</span>
                </th>
                <th className="text-gray-700 text-center py-1 px-0.5 font-bold text-[11px] border border-gray-300 bg-gray-200 whitespace-nowrap">
                  <span className="inline-block text-left min-w-[44px]">VOL</span>
                </th>
                <th className="text-gray-700 text-center py-1 px-0.5 font-bold text-[11px] border border-gray-300 bg-gray-200 whitespace-nowrap">
                  <span className="inline-block text-left min-w-[44px]">+/-</span>
                </th>
                <th className="text-gray-700 text-center py-1 px-0.5 font-bold text-[11px] border border-gray-300 bg-gray-200 whitespace-nowrap">
                  <span className="inline-block text-left min-w-[46px]">%</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map((stock) => {
                const displayChange = stock.lastChange ?? stock.match.change
                const displayChangePct = stock.lastChangePercent ?? stock.match.change_percent
                const priceColor = stock.match.price > stock.reference
                  ? "text-green-600"
                  : stock.match.price < stock.reference
                  ? "text-red-600"
                  : "text-amber-600"
                const changeColor = displayChange > 0 ? "text-green-600" : displayChange < 0 ? "text-red-600" : "text-amber-600"
                const flashPrice = flashMap[stock.symbol]?.price
                const flashVol = flashMap[stock.symbol]?.volume
                const flashChg = flashMap[stock.symbol]?.change
                const flashPct = flashMap[stock.symbol]?.change_percent

                return (
                  <tr key={stock.symbol} className="odd:bg-gray-50 even:bg-white hover:bg-cyan-50 transition-colors cursor-pointer">
                    <td className={`py-1 px-0.5 text-center font-bold text-[11px] border border-gray-300 whitespace-nowrap ${priceColor}`}>
                      <Link href={`/stock/${stock.symbol}`}><span className="inline-block text-left min-w-[38px] hover:underline">{stock.symbol}</span></Link>
                    </td>
                    <td className="py-1 px-0.5 text-center font-semibold text-[11px] tabular-nums text-purple-600 border border-gray-300 whitespace-nowrap">
                      <span className="inline-block text-left min-w-[46px]">{stock.ceiling?.toLocaleString("vi-VN")}</span>
                    </td>
                    <td className="py-1 px-0.5 text-center font-semibold text-[11px] tabular-nums text-cyan-700 border border-gray-300 whitespace-nowrap">
                      <span className="inline-block text-left min-w-[46px]">{stock.floor?.toLocaleString("vi-VN")}</span>
                    </td>
                    <td className="py-1 px-0.5 text-center font-semibold text-[11px] tabular-nums text-amber-600 border border-gray-300 whitespace-nowrap">
                      <span className="inline-block text-left min-w-[46px]">{stock.reference?.toLocaleString("vi-VN")}</span>
                    </td>
                    <td className={`py-1 px-0.5 text-center font-bold text-[11px] tabular-nums border border-gray-300 whitespace-nowrap ${flashPrice ? "" : priceColor} ${flashCellClass(flashPrice)}`}>
                      <span className="inline-block text-left min-w-[46px]">{stock.match.price ? stock.match.price.toLocaleString("vi-VN") : ""}</span>
                    </td>
                    <td className={`py-1 px-0.5 text-center font-semibold text-[11px] tabular-nums border border-gray-300 whitespace-nowrap ${flashVol ? "" : "text-gray-700"} ${flashCellClass(flashVol)}`}>
                      <span className="inline-block text-left min-w-[44px]">{stock.match.volume > 0 ? formatVolume(stock.match.volume) : ""}</span>
                    </td>
                    <td className={`py-1 px-0.5 text-center font-semibold text-[11px] tabular-nums border border-gray-300 whitespace-nowrap ${flashChg ? "" : changeColor} ${flashCellClass(flashChg)}`}>
                      {displayChange != null ? (
                        displayChange === 0 ? (
                          <span className="inline-block text-center">0</span>
                        ) : (
                          <span className="inline-block text-left min-w-[44px]">{(displayChange > 0 ? "+" : "") + displayChange}</span>
                        )
                      ) : ""}
                    </td>
                    <td className={`py-1 px-0.5 text-center font-semibold text-[11px] tabular-nums border border-gray-300 whitespace-nowrap ${flashPct ? "" : changeColor} ${flashCellClass(flashPct)}`}>
                      {displayChangePct != null ? (
                        displayChangePct === 0 ? (
                          <span className="inline-block text-center">0%</span>
                        ) : (
                          <span className="inline-block text-left min-w-[46px]">{(displayChangePct > 0 ? "+" : "") + displayChangePct + "%"}</span>
                        )
                      ) : ""}
                    </td>
                    <td className="py-1 px-0.5 text-center font-semibold text-[11px] tabular-nums text-gray-700 border border-gray-300 whitespace-nowrap">
                      <span className="inline-block text-left min-w-[46px]">{stock.high > 0 ? stock.high.toLocaleString("vi-VN") : "-"}</span>
                    </td>
                    <td className="py-1 px-0.5 text-center font-semibold text-[11px] tabular-nums text-gray-700 border border-gray-300 whitespace-nowrap">
                      <span className="inline-block text-left min-w-[46px]">{stock.low > 0 ? stock.low.toLocaleString("vi-VN") : "-"}</span>
                    </td>
                    <td className="py-0.5 px-0.5 text-center text-[11px] border border-gray-300">
                      <PredictionCell
                        trend={predictions[stock.symbol]?.predictionTrend ?? null}
                        confidence={predictions[stock.symbol]?.confidence}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
