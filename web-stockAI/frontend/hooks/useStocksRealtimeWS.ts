import { useEffect, useRef, useState } from "react";
import { API_URL } from "@/lib/api";
import { useStockWSContext } from "@/lib/stockWSContext";
import { cachedFetch } from "@/lib/apiCache";

export interface StockRealtime {
    symbol: string;
    ceiling: number;
    floor: number;
    reference: number;
    high: number;
    low: number;
    match: {
        price: number;
        volume: number;
        change: number;
        change_percent: number;
        last_size: number;
    };
    lastChange?: number;
    lastChangePercent?: number;
}

const ALL_SYMBOLS = new Set<string>(["AAA","AAM","ABS","ABT","ACB","ACC","ACL","ADG","ADP","ADS","AGG","AGR","ANV","APG","APH","ASM","ASP","AST","BAF","BCE","BCM","BFC","BIC","BID","BKG","BMC","BMI","BMP","BRC","BSI","BTP","BVH","BWE","C32","CCL","CDC","CII","CLC","CLL","CMG","CMX","CNG","CRC","CRE","CSM","CSV","CTD","CTF","CTG","CTI","CTR","CTS","D2D","DAH","DBC","DBD","DBT","DC4","DCL","DCM","DGC","DGW","DHA","DHC","DHM","DIG","DMC","DPG","DPM","DPR","DRC","DRL","DSC","DSE","DSN","DTA","DVP","DXG","DXS","EIB","ELC","EVE","EVF","FCM","FCN","FIR","FIT","FMC","FPT","FRT","FTS","GAS","GDT","GEE","GEX","GIL","GMD","GSP","GVR","HAG","HAH","HAP","HAR","HAX","HCD","HCM","HDB","HDC","HDG","HHP","HHS","HHV","HID","HII","HMC","HPG","HPX","HQC","HSG","HSL","HT1","HTG","HTI","HTN","HUB","HVH","ICT","IDI","IJC","ILB","IMP","ITC","ITD","JVC","KBC","KDC","KDH","KHG","KHP","KMR","KOS","KSB","LAF","LBM","LCG","LHG","LIX","LPB","LSS","MBB","MCM","MCP","MHC","MIG","MSB","MSH","MSN","MWG","NAB","NAF","NBB","NCT","NHA","NHH","NKG","NLG","NNC","NO1","NSC","NT2","NTL","OCB","OGC","ORS","PAC","PAN","PC1","PDR","PET","PGC","PHC","PHR","PIT","PLP","PLX","PNJ","POW","PPC","PTB","PTC","PTL","PVD","PVP","PVT","QCG","RAL","REE","RYG","SAB","SAM","SAV","SBG","SBT","SCR","SCS","SFC","SFG","SGN","SGR","SGT","SHB","SHI","SIP","SJD","SJS","SKG","SMB","SSB","SSI","ST8","STB","STK","SVT","SZC","SZL","TCB","TCH","TCI","TCL","TCM","TCO","TCT","TDC","TDG","TDP","TEG","THG","TIP","TLD","TLG","TLH","TMT","TNH","TNI","TNT","TPB","TRC","TSC","TTA","TTF","TV2","TVS","TYA","UIC","VCA","VCB","VCG","VCI","VDS","VFG","VGC","VHC","VHM","VIB","VIC","VIP","VIX","VJC","VMD","VND","VNL","VNM","VNS","VOS","VPB","VPG","VPH","VPI","VRC","VRE","VSC","VTO","VTP","YBM","YEG"]);

function getHoseTickSize(price: number): number {
    if (price < 10000) return 10;
    if (price < 50000) return 50;
    return 100;
}

function roundToTick(price: number, isCeiling: boolean): number {
    const tick = getHoseTickSize(price);
    return isCeiling ? Math.ceil(price / tick) * tick : Math.floor(price / tick) * tick;
}

function getLimitPrice(reference: number, isCeiling: boolean): number {
    if (reference === 0) return 0;
    return roundToTick(reference * (isCeiling ? 1.07 : 0.93), isCeiling);
}

function saveChangeValues(symbol: string, change: number, changePercent: number) {
    try {
        localStorage.setItem(`stock_change_${symbol}`, JSON.stringify({ change, changePercent, timestamp: Date.now() }));
    } catch {}
}

function loadChangeValues(symbol: string): { change: number; changePercent: number } | null {
    try {
        const data = localStorage.getItem(`stock_change_${symbol}`);
        if (data) {
            const parsed = JSON.parse(data);
            if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
                return { change: parsed.change, changePercent: parsed.changePercent };
            }
        }
    } catch {}
    return null;
}

export function useStocksRealtimeWS() {
    const [stocks, setStocks] = useState<StockRealtime[]>([]);
    const referencesRef = useRef<Map<string, number>>(new Map());
    const stocksRef = useRef<Record<string, StockRealtime>>({});
    const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { subscribe, unsubscribe } = useStockWSContext();

    useEffect(() => {
        let isMounted = true;

        const handleMessage = (data: any) => {
            if (!data.symbol) return;
            const symbol = data.symbol;
            const price = data.price ?? 0;
            if (!ALL_SYMBOLS.has(symbol)) return;

            const reference = referencesRef.current.get(symbol) ?? 0;
            const oldStock = stocksRef.current[symbol];

            let currentHigh = oldStock?.high ?? 0;
            let currentLow = oldStock?.low ?? 0;
            if (price > 0) {
                if (currentHigh === 0) currentHigh = price;
                if (currentLow === 0) currentLow = price;
                currentHigh = Math.max(currentHigh, price);
                currentLow = Math.min(currentLow, price);
            }

            const currentChange = (data.change !== undefined && data.change !== 0) ? data.change : (oldStock?.match.change ?? 0);
            const currentChangePercent = (data.change_percent !== undefined && data.change_percent !== 0) ? data.change_percent : (oldStock?.match.change_percent ?? 0);

            const message: StockRealtime = {
                symbol,
                ceiling: getLimitPrice(reference, true),
                floor: getLimitPrice(reference, false),
                reference,
                high: currentHigh,
                low: currentLow,
                match: {
                    price,
                    volume: data.day_volume ?? 0,
                    change: currentChange,
                    change_percent: currentChangePercent,
                    last_size: data.last_size ?? 0,
                },
                lastChange: (currentChange !== 0 && data.change !== undefined) ? currentChange : (oldStock?.lastChange ?? currentChange),
                lastChangePercent: (currentChangePercent !== 0 && data.change_percent !== undefined) ? currentChangePercent : (oldStock?.lastChangePercent ?? currentChangePercent),
            };

            if (data.change !== undefined && data.change !== 0) {
                saveChangeValues(symbol, currentChange, currentChangePercent);
            }

            stocksRef.current[symbol] = message;
            if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
            updateTimerRef.current = setTimeout(() => {
                if (!isMounted) return;
                const ordered = Array.from(ALL_SYMBOLS)
                    .map(sym => stocksRef.current[sym])
                    .filter((s): s is StockRealtime => Boolean(s));
                setStocks(ordered);
            }, 150);
        };

        subscribe("useStocksRealtimeWS", handleMessage);

        async function fetchInitialData() {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            try {
                // Fetch reference riêng trước — phải xong trước khi tính ceiling/floor
                const refData = await fetch(`${API_URL}/stocks/get_reference`, { signal: controller.signal }).then(r => r.json());
                const refMap = new Map<string, number>();
                refData.forEach((item: any) => refMap.set(item.symbol, item.close));
                referencesRef.current = refMap;

                // Sau khi có reference mới fetch song song daily + latest
                const [dailyData, latestData] = await Promise.all([
                    fetch(`${API_URL}/stocks/get_stocks`, { signal: controller.signal }).then(r => r.json()),
                    cachedFetch(`${API_URL}/stocks/stocks_latest`),
                ]);
                clearTimeout(timeoutId);

                interface DailyValues { high: number; low: number }
                const dailyMap = new Map<string, DailyValues>(dailyData.map((item: any) => [
                    item.symbol.split(".")[0],
                    { high: item.high ?? 0, low: item.low ?? 0 }
                ]));

                const formatted: StockRealtime[] = latestData
                    .filter((item: any) => ALL_SYMBOLS.has(item.symbol?.split(".")[0]))
                    .map((item: any) => {
                        const symbol = item.symbol.split(".")[0];
                        // refMap đã có data vì await ở trên
                        const reference = refMap.get(symbol) ?? 0;
                        const currentPrice = item.price ?? 0;
                        const dailyValues = dailyMap.get(symbol);
                        let currentChange = item.change ?? 0;
                        let currentChangePercent = item.change_percent ?? 0;
                        if (currentChange === 0) {
                            const saved = loadChangeValues(symbol);
                            if (saved) { currentChange = saved.change; currentChangePercent = saved.changePercent; }
                        }
                        return {
                            symbol,
                            ceiling: getLimitPrice(reference, true),
                            floor: getLimitPrice(reference, false),
                            reference,
                            high: dailyValues?.high ?? 0,
                            low: dailyValues?.low ?? 0,
                            match: { price: currentPrice, volume: item.day_volume ?? 0, change: currentChange, change_percent: currentChangePercent, last_size: item.last_size ?? 0 },
                            lastChange: currentChange,
                            lastChangePercent: currentChangePercent,
                        };
                    });

                const tmpMap: Record<string, StockRealtime> = {};
                formatted.forEach(s => { tmpMap[s.symbol] = s; });
                if (isMounted) {
                    const filtered = Array.from(ALL_SYMBOLS).map(sym => tmpMap[sym]).filter((s): s is StockRealtime => Boolean(s));
                    setStocks(filtered);
                    filtered.forEach(s => { stocksRef.current[s.symbol] = s; });
                }
            } catch {
                clearTimeout(timeoutId);
            }
        }

        fetchInitialData();

        return () => {
            isMounted = false;
            unsubscribe("useStocksRealtimeWS");
            if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return stocks;
}
