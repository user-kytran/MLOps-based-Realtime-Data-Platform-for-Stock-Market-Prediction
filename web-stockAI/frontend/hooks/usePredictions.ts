import { API_URL } from '@/lib/api';
import { useEffect, useState } from 'react';

interface Prediction {
  symbol: string;
  prediction_date: string;
  predicted_price: number;
  confidence_score: number;
}

export interface StockPrediction {
  symbol: string;
  predictionTrend: 'up' | 'down' | 'neutral' | null;
  confidence: number;
}

const CACHE_KEY = 'predictions_cache'
const CACHE_TTL = 30 * 60 * 1000

function loadFromSession(): Record<string, StockPrediction> | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts < CACHE_TTL) return data
  } catch {}
  return null
}

function saveToSession(data: Record<string, StockPrediction>) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }))
  } catch {}
}

export function usePredictions(): Record<string, StockPrediction> {
  const [predictions, setPredictions] = useState<Record<string, StockPrediction>>(() => loadFromSession() ?? {});

  useEffect(() => {
    const fetchPredictions = async () => {
      const cached = loadFromSession()
      if (cached && Object.keys(cached).length > 0) setPredictions(cached)

      try {
        const [predictionsRes, stocksRes] = await Promise.all([
          fetch(`${API_URL}/stocks/stock_predictions`),
          fetch(`${API_URL}/stocks/get_reference`)
        ]);
        if (!predictionsRes.ok || !stocksRes.ok) return;

        const predictionsData: Prediction[] = await predictionsRes.json();
        const stocksData = await stocksRes.json();

        const closePrices: Record<string, number> = {};
        stocksData.forEach((stock: any) => {
          closePrices[stock.symbol.split('.')[0]] = stock.close;
        });

        const predictionsMap: Record<string, StockPrediction> = {};
        predictionsData.forEach((pred) => {
          const closePrice = closePrices[pred.symbol] || 0;
          predictionsMap[pred.symbol] = {
            symbol: pred.symbol,
            predictionTrend: pred.predicted_price > closePrice ? 'up' : pred.predicted_price < closePrice ? 'down' : 'neutral',
            confidence: pred.confidence_score
          };
        });

        saveToSession(predictionsMap)
        setPredictions(predictionsMap);
      } catch {}
    };

    fetchPredictions();
    const interval = setInterval(fetchPredictions, CACHE_TTL);
    return () => clearInterval(interval);
  }, []);

  return predictions;
}
