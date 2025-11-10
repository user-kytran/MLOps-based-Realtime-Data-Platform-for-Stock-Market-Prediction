import { useEffect, useRef, useState } from "react";
import { API_URL, WS_URL } from "@/lib/api";

export interface StockRealtime {
    symbol: string;
    price: number;
    change: number;
    change_percent: number;
    day_volume: number;
}

export function useTopMoversWS() {
    const [gainers, setGainers] = useState<StockRealtime[]>([]);
    const [losers, setLosers] = useState<StockRealtime[]>([]);
    const stocksRef = useRef<Record<string, StockRealtime>>({});
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectRef = useRef<NodeJS.Timeout | null>(null);
    useEffect(() => {
        let isMounted = true;
        function connectWS() {
            const socket = new WebSocket(
                `${WS_URL}/stocks/ws/stocks_realtime`
            );
            wsRef.current = socket;
            socket.onopen = () => {
                console.log("✅ Connected to TopMovers WS");
            };
            socket.onmessage = (event) => {
                if (!isMounted) return;
                let data: any;
                try {
                    data = JSON.parse(event.data);
                } catch (e) {
                    console.error("❌ Parse error:", e, event.data);
                    return;
                }
                
                if (!data.symbol) return;
                
                // Cập nhật stock mới nhất
                stocksRef.current[data.symbol] = {
                    symbol: data.symbol,
                    price: data.price ?? 0,
                    change: data.change ?? 0,
                    change_percent: data.change_percent ?? 0,
                    day_volume: data.day_volume ?? 0,
                };
                const stocksArray = Object.values(stocksRef.current);
                const topGainers = [...stocksArray]
                    .sort((a, b) => b.change_percent - a.change_percent)
                    .slice(0, 5);
                const topLosers = [...stocksArray]
                    .sort((a, b) => a.change_percent - b.change_percent)
                    .slice(0, 5);
                setGainers(topGainers);
                setLosers(topLosers);
            };
            socket.onclose = () => {
                reconnectRef.current = setTimeout(connectWS, 3000);
            };
            socket.onerror = (err) => {
                console.error("⚠️ WS error:", err);
                socket.close();
            };
        }
        // 1. Fetch snapshot từ API trước để có dữ liệu ngay
        async function fetchSnapshot() {
            try {
                const res = await fetch(`${API_URL}/stocks/stocks_gainers_losers`);
                const data = await res.json();

                if (data.gainers && data.losers) {
                    setGainers(data.gainers);
                    setLosers(data.losers);
                    // console.log("📥 Fetched initial snapshot:", data);
                }
            } catch (err) {
                console.error("❌ Failed to fetch snapshot:", err);
            }
        }
        fetchSnapshot();

        // 2. Kết nối WS để nhận dữ liệu realtime
        const now = new Date();
        const weekday = now.getDay();
        const hour = now.getHours();
        if (weekday >= 1 && weekday <= 5 && hour >= 9 && hour < 15) {
            console.log("⏯️ Trong giờ, kết nối WS...");
            connectWS();
        } else {
            console.log("⏸ Ngoài giờ, chỉ hiển thị snapshot");
        }
        return () => {
            isMounted = false;
            console.log("🧹 Cleanup TopMovers WS...");
            if (reconnectRef.current) {
                clearTimeout(reconnectRef.current);
                reconnectRef.current = null;
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);
    return { gainers, losers };
}


