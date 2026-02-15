import { useState, useEffect, useCallback } from 'react';
import { fetchMarketStats, MarketStats } from '../api/client';

interface UseMarketStatsResult {
  stats: MarketStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useMarketStats(symbol: string): UseMarketStatsResult {
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMarketStats(symbol);
      setStats(result);
      if (!result) {
        setError('Market data unavailable for this symbol');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch market stats');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  // Initial fetch and refetch on symbol change
  useEffect(() => {
    fetch();
  }, [fetch]);

  // Refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetch, 60000);
    return () => clearInterval(interval);
  }, [fetch]);

  return { stats, loading, error, refetch: fetch };
}

// Format large numbers for display
export function formatNumber(num: number): string {
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

// Format price with appropriate decimals
export function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
}
