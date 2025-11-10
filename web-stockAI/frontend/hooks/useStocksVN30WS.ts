import { useEffect, useRef, useState } from "react";
import { API_URL, WS_URL } from "@/lib/api";

export interface StockRealtime {
    symbol: string;
    ceiling: number;   // giá trần
    floor: number;     // giá sàn
    reference: number; // TC
    match: {
        price: number;
        volume: number;
        change: number;
        change_percent: number;
        last_size: number;
    };
}

// Danh sách VN30 cố định (mã cơ sở, không đuôi sàn) theo thứ tự mong muốn
const VN30_LIST: string[] = ["ACB","BCM","BID","CTG","DGC","FPT","GAS","GVR","HDB","HPG","LPB","MBB","MSN","MWG","PLX","SAB","SHB","SSB","SSI","STB","TCB","TPB","VCB","VHM","VIB","VIC","VJC","VNM","VPB","VRE"];
const VN30_SYMBOLS = new Set<string>(VN30_LIST);

// Tính giá trần/sàn HOSE ±7%
function getLimitPrice(reference: number, isCeiling: boolean) {
    if (reference === 0) return 0;
    const limit = Math.round(reference * 0.07);
    return isCeiling ? reference + limit : reference - limit;
}

export function useStocksVN30WS() {
    const [stocks, setStocks] = useState<StockRealtime[]>([]);
    const referencesRef = useRef<Map<string, number>>(new Map());
    const stocksRef = useRef<Record<string, StockRealtime>>({});
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectRef = useRef<NodeJS.Timeout | null>(null);
    const updateTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        let isMounted = true;

        // --- Hàm mở WebSocket ---
        function connectWS() {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                return; // đã connect thì thôi
            }
            const socket = new WebSocket(
                `${WS_URL}/stocks/ws/stocks_realtime`
            );
            wsRef.current = socket;
            socket.onopen = () => {
                console.log("✅ Connected to Stocks VN30 WS");
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
                
                // Chỉ xử lý VN30
                if (!VN30_SYMBOLS.has(symbol)) return;
                
                // tra reference
                const reference = referencesRef.current.get(symbol) ?? 0;
                if (reference === 0) {
                    console.log(`⚠️ No reference for ${symbol}, skipping`);
                    return;
                }
                const message: StockRealtime = {
                    symbol,
                    ceiling: getLimitPrice(reference, true),
                    floor: getLimitPrice(reference, false),
                    reference,
                    match: {
                        price,
                        volume: data.day_volume ?? 0,
                        change: data.change ?? 0,
                        change_percent: data.change_percent ?? 0,
                        last_size: data.last_size ?? 0,
                    },
                };
                
                // Cập nhật vào ref
                stocksRef.current[symbol] = message;
                if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
                updateTimerRef.current = setTimeout(() => {
                    if (!isMounted) return;
                    const bySymbol: Record<string, StockRealtime> = stocksRef.current;
                    const ordered = VN30_LIST
                        .map(sym => bySymbol[sym])
                        .filter((s): s is StockRealtime => Boolean(s))
                        .slice(0, 30);
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

        // 2. Fetch snapshot
        async function fetchSnapshot() {
            try {
                const now = new Date();
                const weekday = now.getDay();
                const hour = now.getHours();
                const isWeekend = weekday === 0 || weekday === 6;
                const isTradingDay = weekday >= 1 && weekday <= 5;
                const showData = isWeekend || (isTradingDay && hour >= 9);
                const res = await fetch(`${API_URL}/stocks/stocks_VN30`);
                const data = await res.json();
                const formatted: StockRealtime[] = data
                    .filter((item: any) => VN30_SYMBOLS.has(item.symbol?.split(".")[0]))
                    .map((item: any) => {
                        const symbolFull = item.symbol;
                        const symbol = symbolFull.split(".")[0];
                        const reference = referencesRef.current.get(symbol) ?? item.reference ?? 0;
                        return {
                            symbol,
                            ceiling: getLimitPrice(reference, true),
                            floor: getLimitPrice(reference, false),
                            reference,
                            match: showData ? {
                                price: item.price ?? 0,
                                volume: item.day_volume ?? 0,
                                change: item.change ?? 0,
                                change_percent: item.change_percent ?? 0,
                                last_size: item.last_size ?? 0,
                            } : {
                                price: null as any,
                                volume: null as any,
                                change: null as any,
                                change_percent: null as any,
                                last_size: null as any,
                            },
                        };
                    });

                // Lọc theo VN30 và giữ thứ tự cố định VN30_LIST
                const tmpMap: Record<string, StockRealtime> = {};
                formatted.forEach(s => { tmpMap[s.symbol] = s; });
                const filtered = VN30_LIST
                    .map(sym => tmpMap[sym])
                    .filter((s): s is StockRealtime => Boolean(s))
                    .slice(0, 30);
                // Set state và populate ref
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
        fetchSnapshot();

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