import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchIndicator, IndicatorDataPoint } from '../api/client';

export interface IndicatorConfig {
  id: string;           // unique key like 'ema-20'
  name: string;         // indicator name for API: 'ema', 'rsi', etc.
  label: string;        // display label: 'EMA 20'
  color: string;        // line color
  params: Record<string, number>;
  pane?: 'main' | 'separate'; // 'separate' for RSI, Stoch, etc.
  bounds?: { min: number; max: number }; // y-axis bounds for oscillators
  levels?: number[];    // horizontal reference lines (e.g., [30, 70] for RSI)
}

export const AVAILABLE_INDICATORS: IndicatorConfig[] = [
  // Moving Averages (overlay on price)
  { id: 'ema-12', name: 'ema', label: 'EMA 12', color: '#22c55e', params: { length: 12 }, pane: 'main' },
  { id: 'ema-20', name: 'ema', label: 'EMA 20', color: '#f59e0b', params: { length: 20 }, pane: 'main' },
  { id: 'ema-26', name: 'ema', label: 'EMA 26', color: '#ef4444', params: { length: 26 }, pane: 'main' },
  { id: 'ema-50', name: 'ema', label: 'EMA 50', color: '#8b5cf6', params: { length: 50 }, pane: 'main' },
  { id: 'ema-200', name: 'ema', label: 'EMA 200', color: '#06b6d4', params: { length: 200 }, pane: 'main' },
  { id: 'sma-20', name: 'sma', label: 'SMA 20', color: '#3b82f6', params: { length: 20 }, pane: 'main' },
  { id: 'sma-50', name: 'sma', label: 'SMA 50', color: '#0ea5e9', params: { length: 50 }, pane: 'main' },
  { id: 'sma-200', name: 'sma', label: 'SMA 200', color: '#ef4444', params: { length: 200 }, pane: 'main' },
  { id: 'vwap', name: 'vwap', label: 'VWAP', color: '#14b8a6', params: {}, pane: 'main' },

  // Bands & Channels (overlay on price)
  { id: 'bbands', name: 'bbands', label: 'Bollinger', color: '#6366f1', params: { length: 20, std: 2 }, pane: 'main' },
  { id: 'kc', name: 'kc', label: 'Keltner', color: '#f97316', params: { length: 20, scalar: 2 }, pane: 'main' },
  { id: 'donchian', name: 'donchian', label: 'Donchian', color: '#10b981', params: { lower_length: 20, upper_length: 20 }, pane: 'main' },

  // Trend Overlays
  { id: 'supertrend', name: 'supertrend', label: 'SuperTrend', color: '#22c55e', params: { length: 7, multiplier: 3.0 }, pane: 'main' },
  { id: 'psar', name: 'psar', label: 'Parabolic SAR', color: '#fbbf24', params: { af0: 0.02, af: 0.02, max_af: 0.2 }, pane: 'main' },
  { id: 'ichimoku', name: 'ichimoku', label: 'Ichimoku', color: '#ec4899', params: { tenkan: 9, kijun: 26, senkou: 52 }, pane: 'main' },

  // Bounded Oscillators (0-100)
  { id: 'rsi-7', name: 'rsi', label: 'RSI 7', color: '#f43f5e', params: { length: 7 }, pane: 'separate', bounds: { min: 0, max: 100 }, levels: [30, 70] },
  { id: 'rsi-14', name: 'rsi', label: 'RSI 14', color: '#ec4899', params: { length: 14 }, pane: 'separate', bounds: { min: 0, max: 100 }, levels: [30, 70] },
  { id: 'mfi-14', name: 'mfi', label: 'MFI', color: '#10b981', params: { length: 14 }, pane: 'separate', bounds: { min: 0, max: 100 }, levels: [20, 80] },
  { id: 'stoch', name: 'stoch', label: 'Stochastic', color: '#f97316', params: { k: 14, d: 3 }, pane: 'separate', bounds: { min: 0, max: 100 }, levels: [20, 80] },
  { id: 'stochrsi', name: 'stochrsi', label: 'Stoch RSI', color: '#8b5cf6', params: { length: 14, rsi_length: 14, k: 3, d: 3 }, pane: 'separate', bounds: { min: 0, max: 100 }, levels: [20, 80] },
  { id: 'willr', name: 'willr', label: 'Williams %R', color: '#a855f7', params: { length: 14 }, pane: 'separate', bounds: { min: -100, max: 0 }, levels: [-20, -80] },
  { id: 'adx-14', name: 'adx', label: 'ADX', color: '#06b6d4', params: { length: 14 }, pane: 'separate', bounds: { min: 0, max: 100 }, levels: [25, 50] },
  { id: 'aroon', name: 'aroon', label: 'Aroon', color: '#14b8a6', params: { length: 25 }, pane: 'separate', bounds: { min: 0, max: 100 }, levels: [30, 70] },

  // Unbounded Oscillators (auto-scale)
  { id: 'macd', name: 'macd', label: 'MACD', color: '#14b8a6', params: {}, pane: 'separate', levels: [0] },
  { id: 'ppo', name: 'ppo', label: 'PPO', color: '#8b5cf6', params: { fast: 12, slow: 26, signal: 9 }, pane: 'separate', levels: [0] },
  { id: 'cci-20', name: 'cci', label: 'CCI', color: '#f43f5e', params: { length: 20 }, pane: 'separate', levels: [-100, 100] },
  { id: 'cmf-20', name: 'cmf', label: 'CMF', color: '#22c55e', params: { length: 20 }, pane: 'separate', levels: [0] },
  { id: 'roc-10', name: 'roc', label: 'ROC', color: '#f59e0b', params: { length: 10 }, pane: 'separate', levels: [0] },
  { id: 'trix', name: 'trix', label: 'TRIX', color: '#6366f1', params: { length: 18 }, pane: 'separate', levels: [0] },
  { id: 'atr-14', name: 'atr', label: 'ATR', color: '#eab308', params: { length: 14 }, pane: 'separate' },
  { id: 'obv', name: 'obv', label: 'OBV', color: '#64748b', params: {}, pane: 'separate' },
];

export interface IndicatorData {
  config: IndicatorConfig;
  points: IndicatorDataPoint[];
  loading: boolean;
  error: string | null;
}

export interface UseIndicatorsOptions {
  symbol: string;
  interval?: string;
  startDate?: string;
  endDate?: string;
}

// Convert symbol format: BTC-USD (frontend/Coinbase) → BTC/USD (backend/CCXT)
function toApiSymbol(symbol: string): string {
  return symbol.replace('-', '/');
}

export function useIndicators({ symbol, interval = '1d', startDate, endDate }: UseIndicatorsOptions) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [indicatorData, setIndicatorData] = useState<Map<string, IndicatorData>>(new Map());
  const fetchingRef = useRef<Set<string>>(new Set());
  const apiSymbol = toApiSymbol(symbol);

  // Toggle an indicator on/off
  const toggleIndicator = useCallback((id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, []);

  // Clear all indicators
  const clearIndicators = useCallback(() => {
    setSelectedIds([]);
    setIndicatorData(new Map());
  }, []);

  // Fetch data for selected indicators
  useEffect(() => {
    if (!apiSymbol || !startDate || !endDate) return;

    selectedIds.forEach(async (id) => {
      // Skip if already fetching
      if (fetchingRef.current.has(id)) return;
      // Skip if we already have data or already encountered an error
      const existing = indicatorData.get(id);
      if (existing && (existing.points.length > 0 || existing.error)) return;

      const config = AVAILABLE_INDICATORS.find(i => i.id === id);
      if (!config) return;

      fetchingRef.current.add(id);
      setIndicatorData(prev => new Map(prev).set(id, {
        config,
        points: [],
        loading: true,
        error: null,
      }));

      try {
        const result = await fetchIndicator(
          apiSymbol,
          config.name,
          interval,
          startDate,
          endDate,
          config.params
        );

        setIndicatorData(prev => new Map(prev).set(id, {
          config,
          points: result.data,
          loading: false,
          error: null,
        }));
      } catch (err) {
        setIndicatorData(prev => new Map(prev).set(id, {
          config,
          points: [],
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to fetch indicator',
        }));
      } finally {
        fetchingRef.current.delete(id);
      }
    });
    // Note: indicatorData intentionally excluded to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, apiSymbol, interval, startDate, endDate]);

  // Clear cached data when symbol or interval changes
  useEffect(() => {
    setIndicatorData(new Map());
  }, [symbol, interval]);

  // Get active indicator data (selected + loaded)
  const activeIndicators = Array.from(indicatorData.values()).filter(
    d => selectedIds.includes(d.config.id) && d.points.length > 0
  );

  return {
    selectedIds,
    toggleIndicator,
    clearIndicators,
    activeIndicators,
    availableIndicators: AVAILABLE_INDICATORS,
    isLoading: Array.from(indicatorData.values()).some(d => d.loading),
  };
}
