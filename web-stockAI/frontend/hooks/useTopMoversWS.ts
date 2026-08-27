import { useEffect, useRef, useState } from "react";
import { API_URL } from "@/lib/api";
import { useStockWSContext } from "@/lib/stockWSContext";

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
    const { subscribe, unsubscribe } = useStockWSContext();

    useEffect(() => {
        let isMounted = true;

        const handleMessage = (data: any) => {
            if (!data.symbol) return;
            stocksRef.current[data.symbol] = {
                symbol: data.symbol,
                price: data.price ?? 0,
                change: data.change ?? 0,
                change_percent: data.change_percent ?? 0,
                day_volume: data.day_volume ?? 0,
            };
            const arr = Object.values(stocksRef.current);
            setGainers([...arr].sort((a, b) => b.change_percent - a.change_percent).slice(0, 5));
            setLosers([...arr].sort((a, b) => a.change_percent - b.change_percent).slice(0, 5));
        };

        subscribe("useTopMoversWS", handleMessage);

        fetch(`${API_URL}/stocks/stocks_gainers_losers`)
            .then(res => res.json())
            .then((data) => {
                if (!isMounted) return;
                if (data.gainers && data.losers) {
                    setGainers(data.gainers);
                    setLosers(data.losers);
                }
            })
            .catch(() => {});

        return () => {
            isMounted = false;
            unsubscribe("useTopMoversWS");
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { gainers, losers };
}
