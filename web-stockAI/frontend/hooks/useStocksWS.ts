import { useEffect, useState } from "react";
import { useStockWSContext } from "@/lib/stockWSContext";

export function useStocksWS() {
    const [data, setData] = useState<{ price: number; volume: number } | null>(null);
    const { subscribe, unsubscribe } = useStockWSContext();

    useEffect(() => {
        subscribe("useStocksWS", (msg) => {
            if (msg.price !== undefined) setData({ price: msg.price, volume: msg.day_volume ?? 0 });
        });
        return () => unsubscribe("useStocksWS");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return data;
}

export function usePriceVolumeWS() {
    return useStocksWS();
}
