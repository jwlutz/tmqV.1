import type { Candle } from '../hooks/useMarketData'

const COINBASE_API = 'https://api.exchange.coinbase.com'

// Coinbase returns: [timestamp, low, high, open, close, volume]
type CoinbaseCandle = [number, number, number, number, number, number]

export async function fetchHistoricalCandles(
  symbol: string = 'BTC-USD',
  interval: string = '1m',
  limit: number = 100,
  endTime?: number // Unix timestamp in seconds
): Promise<Candle[]> {
  // Convert interval to Coinbase granularity (seconds)
  const granularityMap: Record<string, number> = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1h': 3600,
    '6h': 21600,
    '1d': 86400,
  }
  const granularity = granularityMap[interval] || 60

  let url = `${COINBASE_API}/products/${symbol}/candles?granularity=${granularity}`

  if (endTime) {
    // Coinbase uses ISO 8601 format for end parameter
    const endDate = new Date(endTime * 1000).toISOString()
    const startTime = endTime - (granularity * limit)
    const startDate = new Date(startTime * 1000).toISOString()
    url += `&start=${startDate}&end=${endDate}`
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch candles: ${response.statusText}`)
  }

  const data: CoinbaseCandle[] = await response.json()

  // Coinbase returns newest first, we want oldest first
  // Format: [timestamp, low, high, open, close, volume]
  return data
    .map(candle => ({
      time: candle[0],
      open: candle[3],
      high: candle[2],
      low: candle[1],
      close: candle[4],
      volume: candle[5],
    }))
    .reverse()
    .slice(-limit) // Limit results
}
