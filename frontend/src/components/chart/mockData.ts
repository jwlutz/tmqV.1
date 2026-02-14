import type { CandlestickData, HistogramData, Time } from 'lightweight-charts'

// Generate ~30 candles with BTC-like prices (41000-45000 range)
export const MOCK_CANDLES: CandlestickData<Time>[] = [
  { time: '2024-01-01', open: 42000, high: 42500, low: 41800, close: 42300 },
  { time: '2024-01-02', open: 42300, high: 43100, low: 42100, close: 42900 },
  { time: '2024-01-03', open: 42900, high: 43400, low: 42600, close: 43200 },
  { time: '2024-01-04', open: 43200, high: 43500, low: 42800, close: 42900 },
  { time: '2024-01-05', open: 42900, high: 43000, low: 42200, close: 42400 },
  { time: '2024-01-06', open: 42400, high: 42800, low: 42000, close: 42600 },
  { time: '2024-01-07', open: 42600, high: 43300, low: 42400, close: 43100 },
  { time: '2024-01-08', open: 43100, high: 43800, low: 43000, close: 43600 },
  { time: '2024-01-09', open: 43600, high: 44200, low: 43400, close: 44000 },
  { time: '2024-01-10', open: 44000, high: 44500, low: 43700, close: 43800 },
  { time: '2024-01-11', open: 43800, high: 44100, low: 43200, close: 43400 },
  { time: '2024-01-12', open: 43400, high: 43600, low: 42800, close: 43000 },
  { time: '2024-01-13', open: 43000, high: 43500, low: 42700, close: 43300 },
  { time: '2024-01-14', open: 43300, high: 43900, low: 43100, close: 43700 },
  { time: '2024-01-15', open: 43700, high: 44300, low: 43500, close: 44100 },
  { time: '2024-01-16', open: 44100, high: 44600, low: 43900, close: 44400 },
  { time: '2024-01-17', open: 44400, high: 44800, low: 44000, close: 44200 },
  { time: '2024-01-18', open: 44200, high: 44500, low: 43600, close: 43800 },
  { time: '2024-01-19', open: 43800, high: 44000, low: 43200, close: 43500 },
  { time: '2024-01-20', open: 43500, high: 43900, low: 43100, close: 43700 },
  { time: '2024-01-21', open: 43700, high: 44200, low: 43500, close: 44000 },
  { time: '2024-01-22', open: 44000, high: 44700, low: 43800, close: 44500 },
  { time: '2024-01-23', open: 44500, high: 45000, low: 44200, close: 44800 },
  { time: '2024-01-24', open: 44800, high: 45200, low: 44400, close: 44600 },
  { time: '2024-01-25', open: 44600, high: 44900, low: 44000, close: 44200 },
  { time: '2024-01-26', open: 44200, high: 44500, low: 43700, close: 43900 },
  { time: '2024-01-27', open: 43900, high: 44300, low: 43600, close: 44100 },
  { time: '2024-01-28', open: 44100, high: 44600, low: 43900, close: 44400 },
  { time: '2024-01-29', open: 44400, high: 44900, low: 44100, close: 44700 },
  { time: '2024-01-30', open: 44700, high: 45100, low: 44300, close: 44500 },
]

// Generate volume data to match candles
export const MOCK_VOLUME: HistogramData<Time>[] = MOCK_CANDLES.map((candle, i) => {
  const isUp = candle.close >= candle.open
  // Random volume between 1000-5000 BTC
  const baseVolume = 2000 + Math.sin(i * 0.5) * 1000 + (i % 3) * 500
  return {
    time: candle.time,
    value: Math.round(baseVolume),
    color: isUp ? '#22c55e80' : '#ef444480', // Semi-transparent
  }
})
