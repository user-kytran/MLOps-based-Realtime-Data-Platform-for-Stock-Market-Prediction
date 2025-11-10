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

export function usePredictions(): Record<string, StockPrediction> {
  const [predictions, setPredictions] = useState<Record<string, StockPrediction>>({});

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        // Fetch both predictions and current stock data
        const [predictionsRes, stocksRes] = await Promise.all([
          fetch(`${API_URL}/stocks/stock_predictions`),
          fetch(`${API_URL}/stocks/get_reference`)
        ]);

        if (!predictionsRes.ok || !stocksRes.ok) {
          throw new Error('Failed to fetch data');
        }
        
        const predictionsData: Prediction[] = await predictionsRes.json();
        const stocksData = await stocksRes.json();
        
        // Create map of current prices
        const closePrices: Record<string, number> = {};
        stocksData.forEach((stock: any) => {
          closePrices[stock.symbol.split('.')[0]] = stock.close;
        });
        
        // Transform raw predictions into StockPrediction format
        const predictionsMap: Record<string, StockPrediction> = {};
        
        predictionsData.forEach((pred) => {
          const symbol = pred.symbol;
          const closePrice = closePrices[symbol] || 0;
          
          // Compare predicted price with close price to determine trend
          predictionsMap[symbol] = {
            symbol: symbol,
            predictionTrend: pred.predicted_price > closePrice ? 'up' : 
                            pred.predicted_price < closePrice ? 'down' : 'neutral',
            confidence: pred.confidence_score
          };
        });

        setPredictions(predictionsMap);
      } catch (error) {
        console.error('Error fetching predictions:', error);
      }
    };

    // Fetch initial predictions
    fetchPredictions();

    // Set up polling every 5 minutes
    const interval = setInterval(fetchPredictions, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return predictions;
}