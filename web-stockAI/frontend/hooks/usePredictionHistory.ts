import { API_URL } from '@/lib/api';
import { useEffect, useState } from 'react';

export interface PredictionHistoryItem {
  date: string;
  predicted_trend: "up" | "down" | "neutral";
  actual_trend: "up" | "down" | "neutral";
  is_correct: boolean | null;
  predicted_value: number;
  actual_value: number;
}

export interface NextDayPrediction {
  trend: "up" | "down" | "neutral" | null;
  date: string;
}

export function usePredictionHistory(symbol: string) {
  const [chartData, setChartData] = useState<PredictionHistoryItem[]>([]);
  const [nextDayPrediction, setNextDayPrediction] = useState<NextDayPrediction>({ trend: null, date: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPredictionHistory = async () => {
      setLoading(true);
      try {
        const [predictionsRes, dailyRes] = await Promise.all([
          fetch(`${API_URL}/stocks/stock_predictions_history?symbol=${symbol}`),
          fetch(`${API_URL}/stocks/stock_daily_by_symbol?symbol=${symbol}`)
        ]);

        if (!predictionsRes.ok || !dailyRes.ok) {
          setLoading(false);
          return;
        }

        const symbolPredictions = await predictionsRes.json();
        const dailyData = await dailyRes.json();
        
        const predictionsMap: Record<string, any> = {};
        symbolPredictions.forEach((p: any) => {
          const normalizedDate = new Date(p.prediction_date).toISOString().split('T')[0];
          predictionsMap[normalizedDate] = p;
        });

        dailyData.sort((a: any, b: any) => new Date(b.trade_date).getTime() - new Date(a.trade_date).getTime());
        const last5Days = dailyData.slice(0, 5).reverse();

        const dailyMap: Record<string, number> = {};
        dailyData.forEach((d: any) => {
          const normalizedDate = new Date(d.trade_date).toISOString().split('T')[0];
          dailyMap[normalizedDate] = d.close;
        });

        const chartItems: PredictionHistoryItem[] = [];

        for (const day of last5Days) {
          const currentDateNormalized = new Date(day.trade_date).toISOString().split('T')[0];
          const currentClose = day.close;

          const prevDate = new Date(currentDateNormalized);
          prevDate.setDate(prevDate.getDate() - 1);
          while (prevDate.getDay() === 0 || prevDate.getDay() === 6) {
            prevDate.setDate(prevDate.getDate() - 1);
          }
          const prevDateStr = prevDate.toISOString().split('T')[0];
          const prevClose = dailyMap[prevDateStr];

          if (!prevClose) continue;

          let actual_trend: "up" | "down" | "neutral" = "neutral";
          if (currentClose > prevClose) actual_trend = "up";
          else if (currentClose < prevClose) actual_trend = "down";

          const prediction = predictionsMap[currentDateNormalized];
          let predicted_trend: "up" | "down" | "neutral" = "neutral";
          let is_correct: boolean | null = null;

          if (prediction) {
            const predPrice = prediction.predicted_price;
            if (predPrice > prevClose) predicted_trend = "up";
            else if (predPrice < prevClose) predicted_trend = "down";
            
            is_correct = predicted_trend === actual_trend;
          }

          const predicted_value = predicted_trend === "up" ? 1 : predicted_trend === "down" ? -1 : 0;
          const actual_value = actual_trend === "up" ? 1 : actual_trend === "down" ? -1 : 0;

          chartItems.push({
            date: new Date(currentDateNormalized).toLocaleDateString("vi-VN"),
            predicted_trend,
            actual_trend,
            is_correct,
            predicted_value,
            actual_value
          });
        }

        setChartData(chartItems);

        if (dailyData.length > 0) {
          const latestTradingDateNormalized = new Date(dailyData[0].trade_date).toISOString().split('T')[0];
          const latestClose = dailyData[0].close;
          
          const nextDate = new Date(latestTradingDateNormalized);
          nextDate.setDate(nextDate.getDate() + 1);
          while (nextDate.getDay() === 0 || nextDate.getDay() === 6) {
            nextDate.setDate(nextDate.getDate() + 1);
          }
          const nextDateStr = nextDate.toISOString().split('T')[0];
          
          const nextPrediction = predictionsMap[nextDateStr];
          
          if (nextPrediction) {
            const predPrice = nextPrediction.predicted_price;
            let trend: "up" | "down" | "neutral" = "neutral";
            if (predPrice > latestClose) trend = "up";
            else if (predPrice < latestClose) trend = "down";
            
            setNextDayPrediction({
              trend,
              date: nextDate.toLocaleDateString("vi-VN")
            });
          } else {
            setNextDayPrediction({ trend: null, date: "" });
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error fetching prediction history:", error);
        setLoading(false);
      }
    };

    fetchPredictionHistory();
  }, [symbol]);

  return {
    chartData,
    nextDayPrediction,
    loading
  };
}

