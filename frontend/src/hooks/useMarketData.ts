import { useState, useEffect, useRef, useCallback } from 'react'
import { WSClient, fetchHistoricalCandles, isCoinbaseTickerMessage, createSubscribeMessage } from '../lib'

export interface Candle {
  time: number  // Unix timestamp in seconds
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export type WSStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface MarketDataState {
  candles: Candle[]
  currentCandle: Candle | null
  status: WSStatus
  symbol: string
}

// Coinbase WebSocket
const COINBASE_WS = 'wss://ws-feed.exchange.coinbase.com'

const MAX_CANDLES = 5000 // Cap to avoid memory issues

// Convert symbol format: BTC-USD (Coinbase format)
function toCoinbaseSymbol(symbol: string): string {
  // Handle common formats
  if (symbol.includes('-')) return symbol
  if (symbol.endsWith('USD')) {
    return symbol.replace('USD', '-USD')
  }
  if (symbol.endsWith('USDT')) {
    return symbol.replace('USDT', '-USD')
  }
  return symbol
}

export function useMarketData(symbol: string = 'BTC-USD', interval: string = '1m') {
  const coinbaseSymbol = toCoinbaseSymbol(symbol)
  const [candles, setCandles] = useState<Candle[]>([])
  const [currentCandle, setCurrentCandle] = useState<Candle | null>(null)
  const [status, setStatus] = useState<WSStatus>('connecting')
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMoreHistory, setHasMoreHistory] = useState(true)
  const wsRef = useRef<WSClient | null>(null)
  const lastUpdateRef = useRef<number>(0)

  // Fetch historical candles on mount
  useEffect(() => {
    let cancelled = false

    async function loadHistory() {
      try {
        const history = await fetchHistoricalCandles(coinbaseSymbol, interval, 200)
        if (!cancelled && history.length > 0) {
          setCandles(history)
        }
      } catch (error) {
        console.error('Failed to fetch historical candles:', error)
      }
    }

    loadHistory()

    return () => {
      cancelled = true
    }
  }, [coinbaseSymbol, interval])

  // Connect to Coinbase WebSocket for real-time ticker updates
  useEffect(() => {
    const handleMessage = (data: unknown) => {
      if (!isCoinbaseTickerMessage(data)) return

      // Throttle to prevent too many updates
      const now = Date.now()
      if (now - lastUpdateRef.current < 500) return
      lastUpdateRef.current = now

      const price = parseFloat(data.price)
      const volume = parseFloat(data.last_size || '0')
      const time = Math.floor(new Date(data.time).getTime() / 1000)

      // Round time down to current candle interval
      const intervalSeconds = interval === '1m' ? 60 : interval === '5m' ? 300 : 60
      const candleTime = Math.floor(time / intervalSeconds) * intervalSeconds

      setCandles(prev => {
        if (prev.length === 0) {
          // Create first candle from ticker
          return [{
            time: candleTime,
            open: price,
            high: price,
            low: price,
            close: price,
            volume,
          }]
        }

        const newCandles = [...prev]
        const lastIdx = newCandles.length - 1
        const lastCandle = newCandles[lastIdx]

        if (lastCandle.time === candleTime) {
          // Update existing candle
          newCandles[lastIdx] = {
            ...lastCandle,
            high: Math.max(lastCandle.high, price),
            low: Math.min(lastCandle.low, price),
            close: price,
            volume: (lastCandle.volume || 0) + volume,
          }
        } else if (candleTime > lastCandle.time) {
          // New candle - use last close as open
          newCandles.push({
            time: candleTime,
            open: lastCandle.close,
            high: price,
            low: price,
            close: price,
            volume,
          })
          // Keep limited number
          if (newCandles.length > MAX_CANDLES) newCandles.shift()
        }

        return newCandles
      })

      setCurrentCandle({
        time: candleTime,
        open: price,
        high: price,
        low: price,
        close: price,
        volume,
      })
    }

    wsRef.current = new WSClient({
      url: COINBASE_WS,
      onMessage: handleMessage,
      onStatusChange: setStatus,
      onConnect: () => {
        // Subscribe to ticker channel
        wsRef.current?.send(createSubscribeMessage(coinbaseSymbol))
      },
    })

    wsRef.current.connect()

    return () => {
      wsRef.current?.disconnect()
    }
  }, [coinbaseSymbol, interval])

  // Load more historical candles (for lazy loading on scroll)
  const loadMoreHistory = useCallback(async () => {
    if (isLoadingMore || !hasMoreHistory || candles.length === 0) return
    if (candles.length >= MAX_CANDLES) {
      setHasMoreHistory(false)
      return
    }

    setIsLoadingMore(true)
    try {
      const earliestCandle = candles[0]
      // Coinbase endTime is in seconds
      const endTime = earliestCandle.time
      const olderCandles = await fetchHistoricalCandles(coinbaseSymbol, interval, 300, endTime)

      if (olderCandles.length === 0) {
        setHasMoreHistory(false)
      } else {
        setCandles(prev => {
          // Filter out any overlap
          const filteredOlder = olderCandles.filter(c => c.time < prev[0].time)
          const combined = [...filteredOlder, ...prev]
          // Cap at MAX_CANDLES
          if (combined.length > MAX_CANDLES) {
            return combined.slice(combined.length - MAX_CANDLES)
          }
          return combined
        })
      }
    } catch (error) {
      console.error('Failed to load more history:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }, [candles, coinbaseSymbol, interval, isLoadingMore, hasMoreHistory])

  return { candles, currentCandle, status, symbol: coinbaseSymbol, loadMoreHistory, isLoadingMore, hasMoreHistory }
}
