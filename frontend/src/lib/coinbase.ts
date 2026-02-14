import type { Candle } from '../hooks/useMarketData'

// Coinbase ticker message structure
export interface CoinbaseTickerMessage {
  type: 'ticker'
  product_id: string
  price: string
  time: string
  volume_24h: string
  low_24h: string
  high_24h: string
  best_bid: string
  best_ask: string
  last_size?: string  // Size of last trade (not always present)
  side?: string       // Side of last trade
}

export interface CoinbaseSubscribeMessage {
  type: 'subscribe'
  product_ids: string[]
  channels: string[]
}

export function createSubscribeMessage(productId: string): CoinbaseSubscribeMessage {
  return {
    type: 'subscribe',
    product_ids: [productId],
    channels: ['ticker'],
  }
}

export function isCoinbaseTickerMessage(data: unknown): data is CoinbaseTickerMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    (data as CoinbaseTickerMessage).type === 'ticker' &&
    'price' in data
  )
}

// Build/update a candle from ticker data
export function updateCandleFromTicker(
  currentCandle: Candle | null,
  ticker: CoinbaseTickerMessage
): Candle {
  const price = parseFloat(ticker.price)
  const time = Math.floor(new Date(ticker.time).getTime() / 1000)
  // Round to minute boundary for candle time
  const candleTime = time - (time % 60)

  if (!currentCandle || currentCandle.time !== candleTime) {
    // New candle
    return {
      time: candleTime,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: 0, // Coinbase ticker doesn't give per-candle volume
    }
  }

  // Update existing candle
  return {
    ...currentCandle,
    high: Math.max(currentCandle.high, price),
    low: Math.min(currentCandle.low, price),
    close: price,
  }
}
