import { useState, useEffect } from "react";
import { API_URL } from "@/lib/api";
import { cachedFetch } from "@/lib/apiCache";

export interface MarketStatus {
  is_open: boolean;
  is_trading_day: boolean;
  status_code: string;
  session: string;
  label: string;
  server_time: string;
  last_trading_date?: string;
  next_trading_date?: string;
}

export function useMarketStatus() {
  const [status, setStatus] = useState<MarketStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const data = await cachedFetch(`${API_URL}/stocks/market_status`, 15000);
        if (isMounted) {
          setStatus(data);
          setIsLoading(false);
        }
      } catch (err) {
        // Fallback calculation on network error
        if (isMounted) {
          const now = new Date();
          const day = now.getDay();
          const hour = now.getHours();
          const minute = now.getMinutes();
          const totalMins = hour * 60 + minute;
          const isWeekday = day >= 1 && day <= 5;
          const inHours = isWeekday && totalMins >= 9 * 60 && totalMins < 15 * 60;
          const inLunch = isWeekday && totalMins >= 11 * 60 + 30 && totalMins < 13 * 60;

          setStatus({
            is_open: inHours && !inLunch,
            is_trading_day: isWeekday,
            status_code: inLunch ? "LUNCH_BREAK" : inHours ? "CONTINUOUS" : "CLOSED",
            session: inHours && !inLunch ? "CONTINUOUS" : "CLOSED",
            label: inLunch ? "Nghỉ trưa (11:30 - 13:00)" : (inHours ? "Đang trong phiên giao dịch" : "Thị trường đóng cửa"),
            server_time: now.toISOString(),
          });
          setIsLoading(false);
        }
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // 30s polling
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return { status, isLoading };
}

