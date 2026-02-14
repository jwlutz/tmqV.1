import type { Candle } from '../hooks/useMarketData'

// Binance kline message structure
export interface BinanceKlineMessage {
  e: string      // Event type
  E: number      // Event time
  s: string      // Symbol
  k: {
    t: number    // Kline start time (ms)
    T: number    // Kline close time (ms)
    s: string    // Symbol
    i: string    // Interval
    o: string    // Open price
    c: string    // Close price
    h: string    // High price
    l: string    // Low price
    v: string    // Volume
    x: boolean   // Is this kline closed?
  }
}

export function parseBinanceKline(msg: BinanceKlineMessage): Candle {
  const k = msg.k
  return {
    time: Math.floor(k.t / 1000), // Convert ms to seconds
    open: parseFloat(k.o),
    high: parseFloat(k.h),
    low: parseFloat(k.l),
    close: parseFloat(k.c),
    volume: parseFloat(k.v),
  }
}

export function isBinanceKlineMessage(data: unknown): data is BinanceKlineMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    'e' in data &&
    (data as BinanceKlineMessage).e === 'kline'
  )
}
