"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Icons } from "@/components/icons"
import Link from "next/link"
import { useStocksRealtimeWS } from "@/hooks/useStocksRealtimeWS"
import { useEffect, useRef, useState } from "react"
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

export function StockTable({ mode = "ALL" as "ALL" | "VN30", sector = "all" as string }) {
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
      
      // So sánh giá khớp lệnh
      if (s.match.price !== null && prev.match.price !== null && s.match.price !== prev.match.price) {
        const dir = s.match.price > prev.match.price ? "up" : "down" as const;
        f.price = dir; 
        (nextDir[s.symbol] ||= {}).price = dir;
      }
      
      // So sánh khối lượng
      if (s.match.volume !== null && prev.match.volume !== null && s.match.volume !== prev.match.volume) {
        const dir = s.match.volume > prev.match.volume ? "up" : "down" as const;
        f.volume = dir; 
        (nextDir[s.symbol] ||= {}).volume = dir;
      }
      
      // So sánh thay đổi giá (sử dụng giá trị hiển thị)
      const currentDisplayChange = s.lastChange ?? s.match.change;
      const prevDisplayChange = prev.lastChange ?? prev.match.change;
      if (currentDisplayChange !== null && prevDisplayChange !== null && currentDisplayChange !== prevDisplayChange) {
        const dir = currentDisplayChange > prevDisplayChange ? "up" : "down" as const;
        f.change = dir; 
        (nextDir[s.symbol] ||= {}).change = dir;
      }
      
      // So sánh phần trăm thay đổi (sử dụng giá trị hiển thị)
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

  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const checkTradingHours = () => {
      const now = new Date();
      const weekday = now.getDay();
      const hour = now.getHours();
      const isTradingHours = weekday >= 1 && weekday <= 5 && hour >= 9 && hour < 15;
      setIsLive(isTradingHours);
    };
    
    checkTradingHours();
    const interval = setInterval(checkTradingHours, 60000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="bg-white/95 backdrop-blur-md border-0 shadow-lg rounded-xl overflow-hidden">
      <CardHeader className="bg-white text-cyan-700 font-extrabold">
        <CardTitle className="flex items-center justify-center gap-2 text-2xl font-extrabold">
          <Icons.TrendingUp className="h-6 w-6" />
          {mode === "VN30" ? "VN30 STOCKS" : "ALL STOCKS"}
          {/* Real-time indicator */}
          {isLive && (
            <div className="flex items-center gap-2 ml-4">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-normal">LIVE</span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto overflow-y-auto max-h-[75vh]">
          <table className="table-auto w-full border-separate border-spacing-0 text-sm bg-white text-gray-900">
            <thead>
              <tr>
                <th rowSpan={2} className="text-gray-800 text-center py-3 px-3 font-extrabold text-[17px] w-[150px] border border-gray-300 sticky top-0 z-20 bg-gray-200">
                  STOCK NAME
                </th>
                <th rowSpan={2} className="text-gray-800 text-center py-3 px-3 font-extrabold text-[17px] w-[150px] border border-gray-300 sticky top-0 z-20 bg-gray-200">
                  CEILING
                </th>
                <th rowSpan={2} className="text-gray-800 text-center py-3 px-3 font-extrabold text-[17px] w-[150px] border border-gray-300 sticky top-0 z-20 bg-gray-200">
                  FLOOR
                </th>
                <th rowSpan={2} className="text-gray-800 text-center py-3 px-3 font-extrabold text-[17px] w-[150px] border border-gray-300 sticky top-0 z-20 bg-gray-200">
                  REFERENCE
                </th>
                <th colSpan={4} className="text-gray-800 text-center py-3 px-3 font-extrabold text-[17px] border border-gray-300 sticky top-0 z-20 bg-gray-200 ">
                  MATCH
                </th>
                <th rowSpan={2} className="text-gray-800 text-center py-3 px-3 font-extrabold text-[17px] w-[150px] border border-gray-300 sticky top-0 z-20 bg-gray-200">
                  HIGH
                </th>
                <th rowSpan={2} className="text-gray-800 text-center py-3 px-3 font-extrabold text-[17px] w-[150px] border border-gray-300 sticky top-0 z-20 bg-gray-200">
                  LOW
                </th>
                <th rowSpan={2} className="text-gray-800 text-center py-3 px-3 font-extrabold text-[17px] w-[150px] border border-gray-300 sticky top-0 z-20 bg-gray-200">
                  PREDICT
                </th>
              </tr>
              <tr>
                <th className="text-gray-700 text-center py-3 px-2 font-extrabold text-xs border border-gray-300 bg-gray-200 sticky top-12 z-10">PRICE</th>
                <th className="text-gray-700 text-center py-3 px-2 font-extrabold text-xs border border-gray-300 bg-gray-200 sticky top-12 z-10">VOLUME</th>
                <th className="text-gray-700 text-center py-3 px-2 font-extrabold text-xs border border-gray-300 bg-gray-200 sticky top-12 z-10">±</th>
                <th className="text-gray-700 text-center py-3 px-2 font-extrabold text-xs border border-gray-300 bg-gray-200 sticky top-12 z-10">%</th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map((stock) => (
                <tr
                  key={stock.symbol}
                  className="odd:bg-gray-50 even:bg-white hover:bg-cyan-50 transition-colors cursor-pointe"
                >
                  {/* Stock Name */}
                  <td
                    className={`py-2 px-3 text-center font-bold text-sm border border-gray-300 ${
                      (stock.lastChange ?? stock.match.change) && (stock.lastChange ?? stock.match.change) > 0
                        ? "text-green-600"
                        : (stock.lastChange ?? stock.match.change) && (stock.lastChange ?? stock.match.change) < 0
                        ? "text-red-600"
                        : "text-gray-600"
                    }`}
                  >
                    <Link href={`/stock/${stock.symbol}`}>
                      <span
                        className={`transition-colors hover:underline ${
                          stock.match.price != null && stock.reference != null && stock.match.price > stock.reference
                            ? "text-green-600"
                            : stock.match.price != null && stock.reference != null && stock.match.price < stock.reference
                            ? "text-red-600"
                            : "text-gray-600"
                        }`}
                      >
                        {stock.symbol}
                      </span>
                    </Link>
                  </td>

                  {/* Ceiling */}
                  <td className="py-2 px-3 text-center font-semibold text-sm text-blue-600 border border-gray-300">
                    {stock.ceiling?.toLocaleString("vi-VN")}
                  </td>

                  {/* Floor */}
                  <td className="py-2 px-3 text-center font-semibold text-sm text-blue-600 border border-gray-300">
                    {stock.floor?.toLocaleString("vi-VN")}
                  </td>

                  {/* Reference */}
                  <td className="py-2 px-3 text-center font-semibold text-sm text-amber-600 border border-gray-300">
                    {stock.reference?.toLocaleString("vi-VN")}
                  </td>

                  {/* Khớp lệnh: Price */}
                  <td className={`py-2 px-3 text-center font-bold text-sm bg-gray-100 border border-gray-300 ${
                    flashMap[stock.symbol]?.price === "up"
                      ? "bg-green-300"
                      : flashMap[stock.symbol]?.price === "down"
                      ? "bg-red-300"
                      : ""
                  } ${
                    stock.match.price != null && stock.reference != null && stock.match.price > stock.reference
                      ? "text-green-600"
                      : stock.match.price != null && stock.reference != null && stock.match.price < stock.reference
                      ? "text-red-600"
                      : "text-gray-600"
                  }`}>
                    {stock.match.price ? stock.match.price.toLocaleString("vi-VN") : ""}
                  </td>

                  {/* Khớp lệnh: Volume */}
                  <td className={`py-2 px-3 text-center font-semibold text-sm bg-gray-100 border border-gray-300 ${
                    flashMap[stock.symbol]?.volume === "up"
                      ? "bg-green-300"
                      : flashMap[stock.symbol]?.volume === "down"
                      ? "bg-red-300"
                      : ""
                  } text-gray-700 border border-gray-300`}>
                    {stock.match.volume > 0 ? stock.match.volume.toLocaleString("vi-VN") : ""}
                  </td>

                  {/* Khớp lệnh: ± */}
                  <td
                    className={`py-2 px-3 text-center font-bold text-sm bg-gray-100 border border-gray-300 ${
                      (stock.lastChange ?? stock.match.change) && (stock.lastChange ?? stock.match.change) > 0
                        ? "text-green-600"
                        : (stock.lastChange ?? stock.match.change) && (stock.lastChange ?? stock.match.change) < 0
                        ? "text-red-600"
                        : "text-gray-600"
                    } ${
                      flashMap[stock.symbol]?.change === "up"
                        ? "bg-green-300"
                        : flashMap[stock.symbol]?.change === "down"
                        ? "bg-red-300"
                        : ""
                    }`}
                  >
                    {(stock.lastChange ?? stock.match.change) ? ((stock.lastChange ?? stock.match.change) > 0 ? "+" : "") + (stock.lastChange ?? stock.match.change) : ""}
                  </td>

                  {/* Khớp lệnh: % */}
                  <td
                    className={`py-2 px-3 text-center font-bold text-sm bg-gray-100 border border-gray-300 ${
                      (stock.lastChangePercent ?? stock.match.change_percent) && (stock.lastChangePercent ?? stock.match.change_percent) > 0
                        ? "text-green-600"
                        : (stock.lastChangePercent ?? stock.match.change_percent) && (stock.lastChangePercent ?? stock.match.change_percent) < 0
                        ? "text-red-600"
                        : "text-gray-600"
                    } ${
                      flashMap[stock.symbol]?.change_percent === "up"
                        ? "bg-green-300"
                        : flashMap[stock.symbol]?.change_percent === "down"
                        ? "bg-red-300"
                        : ""
                    }`}
                  >
                    {(stock.lastChangePercent ?? stock.match.change_percent) ? (stock.lastChangePercent ?? stock.match.change_percent) + "%" : ""}
                  </td>

                  {/* High */}
                  <td className="py-2 px-3 text-center font-semibold text-sm text-gray-700 border border-gray-300">
                    {stock.high && stock.high > 0 ? stock.high.toLocaleString("vi-VN") : "—"}
                  </td>

                  {/* Low */}
                  <td className="py-2 px-3 text-center font-semibold text-sm text-gray-700 border border-gray-300">
                    {stock.low && stock.low > 0 ? stock.low.toLocaleString("vi-VN") : "—"}
                  </td>

                  {/* Predict */}
                  <td className="py-2 px-3 text-center font-semibold text-sm text-purple-700 border border-gray-300">
                    <PredictionCell 
                      trend={predictions[stock.symbol]?.predictionTrend ?? null}
                      confidence={predictions[stock.symbol]?.confidence}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
