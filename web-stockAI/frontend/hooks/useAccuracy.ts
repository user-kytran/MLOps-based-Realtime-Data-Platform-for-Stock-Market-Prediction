import { API_URL } from '@/lib/api';
import { useEffect, useState } from 'react';

interface AccuracyData {
  symbol: string;
  accuracy: number;
  correct: number;
  total: number;
}

const CACHE_KEY = 'accuracy_cache'
const CACHE_TTL = 10 * 60 * 1000

function loadFromSession(): Record<string, AccuracyData> | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts < CACHE_TTL) return data
  } catch {}
  return null
}

function saveToSession(data: Record<string, AccuracyData>) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }))
  } catch {}
}

export function useAccuracy(): Record<string, AccuracyData> {
  const [accuracyData, setAccuracyData] = useState<Record<string, AccuracyData>>(() => loadFromSession() ?? {});

  useEffect(() => {
    const fetchAccuracy = async () => {
      const cached = loadFromSession()
      if (cached) { setAccuracyData(cached); return }

      try {
        const res = await fetch(`${API_URL}/stocks/stock_predictions_accuracy`);
        if (!res.ok) return;
        const data: AccuracyData[] = await res.json();
        const accuracyMap: Record<string, AccuracyData> = {};
        data.forEach((item) => { accuracyMap[item.symbol] = item; });
        saveToSession(accuracyMap)
        setAccuracyData(accuracyMap);
      } catch {}
    };

    fetchAccuracy();
    const interval = setInterval(fetchAccuracy, CACHE_TTL);
    return () => clearInterval(interval);
  }, []);

  return accuracyData;
}
