import { useEffect, useRef, useState } from "react";

export function useStocksWS() {
    const [data, setData] = useState<{ price: number; volume: number } | null>(null);
    const ws = useRef<WebSocket | null>(null);

    useEffect(() => {
        ws.current = new WebSocket("ws://localhost:8005/ws/stocks");
        ws.current.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            setData(msg);
        } catch {}
        };
        ws.current.onerror = () => {
            setData(null);
        };
        return () => {
            ws.current?.close();
        };
    }, []);

    return data;
}
