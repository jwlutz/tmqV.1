import type { Candle } from '../hooks/useMarketData'

const BINANCE_US_API = 'https://api.binance.us/api/v3'

export interface BinanceKline {
  0: number   // Open time
  1: string   // Open
  2: string   // High
  3: string   // Low
  4: string   // Close
  5: string   // Volume
  6: number   // Close time
  7: string   // Quote asset volume
  8: number   // Number of trades
  9: string   // Taker buy base asset volume
  10: string  // Taker buy quote asset volume
  11: string  // Ignore
}

export async function fetchHistoricalCandles(
  symbol: string = 'BTCUSD',
  interval: string = '1m',
  limit: number = 100,
  endTime?: number // Unix timestamp in milliseconds - fetch candles BEFORE this time
): Promise<Candle[]> {
  let url = `${BINANCE_US_API}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  if (endTime) {
    url += `&endTime=${endTime}`
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch candles: ${response.statusText}`)
  }

  const data: BinanceKline[] = await response.json()

  return data.map(kline => ({
    time: Math.floor(kline[0] / 1000), // Convert ms to seconds
    open: parseFloat(kline[1]),
    high: parseFloat(kline[2]),
    low: parseFloat(kline[3]),
    close: parseFloat(kline[4]),
    volume: parseFloat(kline[5]),
  }))
}
