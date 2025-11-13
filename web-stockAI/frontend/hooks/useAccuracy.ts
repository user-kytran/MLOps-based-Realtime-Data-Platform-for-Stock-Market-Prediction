import { API_URL } from '@/lib/api';
import { useEffect, useState } from 'react';

interface AccuracyData {
  symbol: string;
  accuracy: number;
  correct: number;
  total: number;
}

export function useAccuracy(): Record<string, AccuracyData> {
  const [accuracyData, setAccuracyData] = useState<Record<string, AccuracyData>>({});

  useEffect(() => {
    const fetchAccuracy = async () => {
      try {
        const res = await fetch(`${API_URL}/stocks/stock_predictions_accuracy`);
        if (!res.ok) return;
        
        const data: AccuracyData[] = await res.json();
        
        const accuracyMap: Record<string, AccuracyData> = {};
        data.forEach((item) => {
          accuracyMap[item.symbol] = item;
        });

        setAccuracyData(accuracyMap);
      } catch (error) {
        console.error('Error fetching accuracy:', error);
      }
    };

    fetchAccuracy();

    const interval = setInterval(fetchAccuracy, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return accuracyData;
}

