import { useEffect, useRef, useState } from "react";
import { API_URL, WS_URL } from "@/lib/api";

export interface StockRealtime {
    symbol: string;
    ceiling: number;   // giá trần
    floor: number;     // giá sàn
    reference: number; // TC
    high: number;      // giá cao nhất trong ngày
    low: number;       // giá thấp nhất trong ngày
    match: {
        price: number;
        volume: number;
        change: number;
        change_percent: number;
        last_size: number;
    };
    // Lưu giá trị cũ để hiển thị khi change = 0
    lastChange?: number;
    lastChangePercent?: number;
}

const ALL_SYMBOLS = new Set<string>(["AAA","AAM","ABS","ABT","ACB","ACC","ACL","ADG","ADP","ADS","AGG","AGR","ANV","APG","APH","ASM","ASP","AST","BAF","BCE","BCM","BFC","BIC","BID","BKG","BMC","BMI","BMP","BRC","BSI","BTP","BVH","BWE","C32","CCL","CDC","CII","CLC","CLL","CMG","CMX","CNG","CRC","CRE","CSM","CSV","CTD","CTF","CTG","CTI","CTR","CTS","D2D","DAH","DBC","DBD","DBT","DC4","DCL","DCM","DGC","DGW","DHA","DHC","DHM","DIG","DMC","DPG","DPM","DPR","DRC","DRL","DSC","DSE","DSN","DTA","DVP","DXG","DXS","EIB","ELC","EVE","EVF","FCM","FCN","FIR","FIT","FMC","FPT","FRT","FTS","GAS","GDT","GEE","GEX","GIL","GMD","GSP","GVR","HAG","HAH","HAP","HAR","HAX","HCD","HCM","HDB","HDC","HDG","HHP","HHS","HHV","HID","HII","HMC","HPG","HPX","HQC","HSG","HSL","HT1","HTG","HTI","HTN","HUB","HVH","ICT","IDI","IJC","ILB","IMP","ITC","ITD","JVC","KBC","KDC","KDH","KHG","KHP","KMR","KOS","KSB","LAF","LBM","LCG","LHG","LIX","LPB","LSS","MBB","MCM","MCP","MHC","MIG","MSB","MSH","MSN","MWG","NAB","NAF","NBB","NCT","NHA","NHH","NKG","NLG","NNC","NO1","NSC","NT2","NTL","OCB","OGC","ORS","PAC","PAN","PC1","PDR","PET","PGC","PHC","PHR","PIT","PLP","PLX","PNJ","POW","PPC","PTB","PTC","PTL","PVD","PVP","PVT","QCG","RAL","REE","RYG","SAB","SAM","SAV","SBG","SBT","SCR","SCS","SFC","SFG","SGN","SGR","SGT","SHB","SHI","SIP","SJD","SJS","SKG","SMB","SSB","SSI","ST8","STB","STK","SVT","SZC","SZL","TCB","TCH","TCI","TCL","TCM","TCO","TCT","TDC","TDG","TDP","TEG","THG","TIP","TLD","TLG","TLH","TMT","TNH","TNI","TNT","TPB","TRC","TSC","TTA","TTF","TV2","TVS","TYA","UIC","VCA","VCB","VCG","VCI","VDS","VFG","VGC","VHC","VHM","VIB","VIC","VIP","VIX","VJC","VMD","VND","VNL","VNM","VNS","VOS","VPB","VPG","VPH","VPI","VRC","VRE","VSC","VTO","VTP","YBM","YEG"]);

// Tính giá trần/sàn HOSE ±7%
function getLimitPrice(reference: number, isCeiling: boolean) {
    if (reference === 0) return 0;
    const limit = Math.round(reference * 0.07);
    return isCeiling ? reference + limit : reference - limit;
}

// Lưu change values vào localStorage
function saveChangeValues(symbol: string, change: number, changePercent: number) {
    try {
        const key = `stock_change_${symbol}`;
        localStorage.setItem(key, JSON.stringify({ change, changePercent, timestamp: Date.now() }));
    } catch (e) {
        console.error(`Failed to save change for ${symbol}:`, e);
    }
}

// Load change values từ localStorage
function loadChangeValues(symbol: string): { change: number; changePercent: number } | null {
    try {
        const key = `stock_change_${symbol}`;
        const data = localStorage.getItem(key);
        if (data) {
            const parsed = JSON.parse(data);
            const oneDay = 24 * 60 * 60 * 1000;
            if (Date.now() - parsed.timestamp < oneDay) {
                return { change: parsed.change, changePercent: parsed.changePercent };
            }
        }
    } catch (e) {
        console.error(`Failed to load change for ${symbol}:`, e);
    }
    return null;
}

export function useStocksRealtimeWS() {
    const [stocks, setStocks] = useState<StockRealtime[]>([]);
    const referencesRef = useRef<Map<string, number>>(new Map());
    const stocksRef = useRef<Record<string, StockRealtime>>({});
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectRef = useRef<NodeJS.Timeout | null>(null);
    const updateTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        let isMounted = true;

        function connectWS() {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                return;
            }
            const socket = new WebSocket(
                `${WS_URL}/stocks/ws/stocks_realtime`
            );
            wsRef.current = socket;
            socket.onopen = () => {
                console.log("✅ Connected to Stocks Realtime WS");
            };
            socket.onmessage = (event) => {
                if (!isMounted) return;
                let data: any;
                try {
                    data = JSON.parse(event.data);
                } catch (e) {
                    console.error("❌ JSON parse error:", e);
                    return;
                }
                
                if (!data.symbol) return;
                
                const symbol = data.symbol;
                const price = data.price ?? 0;
                
                if (!ALL_SYMBOLS.has(symbol)) return;
                
                // Lấy reference (giá đóng cửa ngày hôm trước)
                const reference = referencesRef.current.get(symbol) ?? 0;
                
                // Lấy dữ liệu cũ để tính HIGH/LOW trong ngày và giữ giá trị change cũ
                const oldStock = stocksRef.current[symbol];
                
                // Kiểm tra giờ giao dịch
                const now = new Date();
                const hour = now.getHours();
                const weekday = now.getDay();
                const isTradingHours = weekday >= 1 && weekday <= 5 && hour >= 9 && hour < 15;
                
                // Xử lý high/low
                let currentHigh = oldStock?.high ?? 0;
                let currentLow = oldStock?.low ?? 0;
                
                if (isTradingHours) {
                    if (currentHigh === 0) currentHigh = price; // Nếu chưa có high, lấy giá hiện tại
                    if (currentLow === 0) currentLow = price;   // Nếu chưa có low, lấy giá hiện tại
                    
                    if (price > 0) { // Chỉ cập nhật khi có giao dịch thực
                        currentHigh = Math.max(currentHigh, price);
                        currentLow = Math.min(currentLow, price);
                    }
                }
                
                if (isTradingHours && price > 0) {
                    currentHigh = Math.max(currentHigh, price);
                    currentLow = currentLow === 0 ? price : Math.min(currentLow, price);
                }
                
                // Chỉ update change khi có dữ liệu WebSocket khác 0, nếu không thì giữ giá trị cũ
                const currentChange = (data.change !== undefined && data.change !== 0) ? data.change : (oldStock?.match.change ?? 0);
                const currentChangePercent = (data.change_percent !== undefined && data.change_percent !== 0) ? data.change_percent : (oldStock?.match.change_percent ?? 0);
                
                // Debug log
                if (data.change !== undefined && data.change !== 0) {
                    console.log(`📈 ${symbol}: Updated change from ${oldStock?.match.change ?? 0} to ${data.change}`);
                }
                
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
                    // Giữ giá trị cũ nếu change = 0 hoặc không có trong data, cập nhật nếu có giá trị mới khác 0
                    lastChange: (currentChange !== 0 && data.change !== undefined) ? currentChange : (oldStock?.lastChange ?? currentChange),
                    lastChangePercent: (currentChangePercent !== 0 && data.change_percent !== undefined) ? currentChangePercent : (oldStock?.lastChangePercent ?? currentChangePercent),
                };
                
                // Lưu vào localStorage nếu có giá trị mới khác 0
                if (data.change !== undefined && data.change !== 0) {
                    saveChangeValues(symbol, currentChange, currentChangePercent);
                }
                
                // Cập nhật vào ref
                stocksRef.current[symbol] = message;
                // Throttle cập nhật state để giảm re-render
                if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
                updateTimerRef.current = setTimeout(() => {
                    if (!isMounted) return;
                    const bySymbol: Record<string, StockRealtime> = stocksRef.current;
                    const ordered = Array.from(ALL_SYMBOLS)
                        .map(sym => bySymbol[sym])
                        .filter((s): s is StockRealtime => Boolean(s));
                    setStocks(ordered);
                }, 150);
            };
            socket.onclose = () => {
                reconnectRef.current = setTimeout(connectWS, 3000);
            };
            socket.onerror = (e) => {
                console.error("⚠️ WebSocket error:", e);
                socket.close();
            };
        }

        // 1. Fetch reference 1 lần
        fetch(`${API_URL}/stocks/get_reference`)
            .then(res => res.json())
            .then((data) => {
                const map = new Map<string, number>();
                data.forEach((item: any) => {
                    map.set(item.symbol, item.close);
                });
                referencesRef.current = map;
                console.log("📌 Loaded references:", map.size, "symbols");
            })
            .catch(err => {
                console.error("❌ Failed to load references:", err);
            });

        // 2. Fetch initial data from stock_daily_summary for high/low
        async function fetchInitialData() {
            try {
                // Fetch high/low from daily summary
                const dailyRes = await fetch(`${API_URL}/stocks/get_stocks`);
                const dailyData = await dailyRes.json();
                interface DailyValues {
                    high: number;
                    low: number;
                }
                const dailyMap = new Map<string, DailyValues>(dailyData.map((item: any) => [
                    item.symbol.split(".")[0],
                    {high: item.high ?? 0, low: item.low ?? 0}
                ]));

                // Fetch latest prices
                const res = await fetch(`${API_URL}/stocks/stocks_latest`);
                const data = await res.json();

                const formatted: StockRealtime[] = data
                    .filter((item: any) => ALL_SYMBOLS.has(item.symbol?.split(".")[0]))
                    .map((item: any) => {
                        const symbolFull = item.symbol;
                        const symbol = symbolFull.split(".")[0];
                        const reference = referencesRef.current.get(symbol) ?? item.reference ?? 0;
                        const currentPrice = item.price ?? 0;
                        
                        // Lấy high/low từ daily summary data
                        const dailyValues = dailyMap.get(symbol);
                        const currentHigh = dailyValues?.high ?? 0;
                        const currentLow = dailyValues?.low ?? 0;  
                        
                        // Nếu change = 0 từ API, load từ localStorage
                        const apiChange = item.change ?? 0;
                        const apiChangePercent = item.change_percent ?? 0;
                        
                        let currentChange = apiChange;
                        let currentChangePercent = apiChangePercent;
                        
                        if (apiChange === 0) {
                            const saved = loadChangeValues(symbol);
                            if (saved) {
                                currentChange = saved.change;
                                currentChangePercent = saved.changePercent;
                            }
                        }
                        
                        return {
                            symbol,
                            ceiling: getLimitPrice(reference, true),
                            floor: getLimitPrice(reference, false),
                            reference,
                            high: currentHigh,
                            low: currentLow,
                            match: {
                                price: currentPrice,
                                volume: item.day_volume ?? 0,
                                change: currentChange,
                                change_percent: currentChangePercent,
                                last_size: item.last_size ?? 0,
                            },
                            lastChange: currentChange,
                            lastChangePercent: currentChangePercent,
                        };
                    });

                const tmpMap: Record<string, StockRealtime> = {};
                formatted.forEach(s => { tmpMap[s.symbol] = s; });
                const filtered = Array.from(ALL_SYMBOLS)
                    .map(sym => tmpMap[sym])
                    .filter((s): s is StockRealtime => Boolean(s));

                if (isMounted) {
                    setStocks(filtered);
                    filtered.forEach(stock => {
                        stocksRef.current[stock.symbol] = stock;
                    });
                }
            } catch (err) {
                console.error("❌ Failed to fetch snapshot:", err);
            }
        }

        fetchInitialData();

        // 3. Connect WebSocket chỉ khi sàn hoạt động
        const now = new Date();
        const weekday = now.getDay();
        const hour = now.getHours();
        const isTradingHours = weekday >= 1 && weekday <= 5 && hour >= 9 && hour < 15;
        
        if (isTradingHours) {
            console.log("⏯️ Trong giờ giao dịch, kết nối WS...");
            connectWS();
        } else if (weekday >= 1 && weekday <= 5 && hour >= 15) {
            console.log("📊 Sau giờ giao dịch, hiển thị dữ liệu cuối ngày");
        } else if (weekday === 0 || weekday === 6) {
            console.log("📅 Cuối tuần, hiển thị dữ liệu T6");
        } else {
            console.log("🌅 Sáng sớm trước 9h, để trống");
        }

        return () => {
            isMounted = false;
            console.log("🧹 Cleanup StocksPopular WS...");
            if (reconnectRef.current) {
                clearTimeout(reconnectRef.current);
                reconnectRef.current = null;
            }
            if (updateTimerRef.current) {
                clearTimeout(updateTimerRef.current);
                updateTimerRef.current = null;
            }
            if (wsRef.current &&
                (wsRef.current.readyState === WebSocket.OPEN ||
                wsRef.current.readyState === WebSocket.CONNECTING)) {
                wsRef.current.close();
            }
        };
    }, []);

    return stocks;
}