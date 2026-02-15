import { useState, useEffect, useRef, useCallback } from 'react'
import { WSClient, fetchHistoricalCandles, isCoinbaseTickerMessage, createSubscribeMessage } from '../lib'
import { fetchOHLCV } from '../api/client'
import { useDataSettings } from '../context'

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

const COINBASE_INTERVALS = new Set(['1m', '5m', '15m', '1h', '6h', '1d'])

const INTERVAL_SECONDS: Record<string, number> = {
  '1m': 60, '5m': 300, '15m': 900, '30m': 1800,
  '1h': 3600, '4h': 14400, '6h': 21600, '1d': 86400,
  '1wk': 604800, '1mo': 2592000,
}

function getDateRange(interval: string): { start: string; end: string } {
  const now = new Date()
  const end = now.toISOString().split('T')[0]
  let daysBack: number
  switch (interval) {
    case '1m': case '5m': daysBack = 2; break
    case '15m': case '30m': daysBack = 7; break
    case '1h': case '4h': daysBack = 30; break
    case '1d': daysBack = 365; break
    case '1wk': daysBack = 3 * 365; break
    case '1mo': daysBack = 10 * 365; break
    default: daysBack = 365
  }
  const startDate = new Date(now.getTime() - daysBack * 86400000)
  return { start: startDate.toISOString().split('T')[0], end }
}

// Convert symbol format: BTC-USD (Coinbase format)
function toCoinbaseSymbol(symbol: string): string {
  if (symbol.includes('-')) return symbol
  if (symbol.endsWith('USD')) {
    return symbol.replace('USD', '-USD')
  }
  if (symbol.endsWith('USDT')) {
    return symbol.replace('USDT', '-USD')
  }
  return symbol
}

// Detect if a symbol is crypto (has live WebSocket data) or equity (REST only)
export function isCryptoSymbol(symbol: string): boolean {
  // Symbols with "/" are ccxt crypto pairs (BTC/USDT)
  if (symbol.includes('/')) return true
  // Symbols ending in -USD are Coinbase crypto (BTC-USD)
  if (symbol.endsWith('-USD') || symbol.endsWith('-USDT')) return true
  return false
}

export function useMarketData(symbol: string = 'BTC-USD', interval: string = '1m') {
  const { equitySource } = useDataSettings()
  const isCrypto = isCryptoSymbol(symbol)
  const coinbaseSymbol = toCoinbaseSymbol(symbol)
  const [candles, setCandles] = useState<Candle[]>([])
  const [currentCandle, setCurrentCandle] = useState<Candle | null>(null)
  const [status, setStatus] = useState<WSStatus>(isCrypto ? 'connecting' : 'connected')
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMoreHistory, setHasMoreHistory] = useState(true)
  const candlesRef = useRef(candles)
  candlesRef.current = candles
  const wsRef = useRef<WSClient | null>(null)
  const lastUpdateRef = useRef<number>(0)

  // Clear stale data and fetch fresh history when symbol changes
  useEffect(() => {
    setCandles([])
    setCurrentCandle(null)
    setHasMoreHistory(true)
    if (!isCrypto) setStatus('connected')
    let cancelled = false

    async function loadHistory() {
      try {
        if (isCrypto && COINBASE_INTERVALS.has(interval)) {
          // Crypto with Coinbase-supported interval: use Coinbase REST
          const history = await fetchHistoricalCandles(coinbaseSymbol, interval, 300)
          if (!cancelled && history.length > 0) {
            setCandles(history)
          }
        } else {
          // Equity or non-Coinbase interval: use backend API
          const { start, end } = getDateRange(interval)
          const apiSymbol = isCrypto ? coinbaseSymbol : symbol
          const res = await fetchOHLCV(apiSymbol, interval, start, end, equitySource)
          if (!cancelled && res.data?.length > 0) {
            const history: Candle[] = res.data.map((d: { date: string; open: number; high: number; low: number; close: number; volume: number }) => ({
              time: Math.floor(new Date(d.date).getTime() / 1000),
              open: d.open,
              high: d.high,
              low: d.low,
              close: d.close,
              volume: d.volume,
            }))
            setCandles(history)
            if (!isCrypto) setStatus('connected')
          }
        }
      } catch (error) {
        console.error('Failed to fetch historical candles:', error)
        if (!cancelled && !isCrypto) setStatus('error')
      }
    }

    loadHistory()

    return () => {
      cancelled = true
    }
  }, [coinbaseSymbol, symbol, interval, equitySource, isCrypto])

  // Connect to Coinbase WebSocket for real-time ticker updates (crypto only)
  useEffect(() => {
    if (!isCrypto) return // Skip WebSocket for equities

    const handleMessage = (data: unknown) => {
      if (!isCoinbaseTickerMessage(data)) return

      const now = Date.now()
      if (now - lastUpdateRef.current < 500) return
      lastUpdateRef.current = now

      const price = parseFloat(data.price)
      const volume = parseFloat(data.last_size || '0')
      const time = Math.floor(new Date(data.time).getTime() / 1000)

      const intervalSeconds = INTERVAL_SECONDS[interval] || 60
      const candleTime = Math.floor(time / intervalSeconds) * intervalSeconds

      setCandles(prev => {
        if (prev.length === 0) {
          return [{
            time: candleTime,
            open: price, high: price, low: price, close: price,
            volume,
          }]
        }

        const newCandles = [...prev]
        const lastIdx = newCandles.length - 1
        const lastCandle = newCandles[lastIdx]

        if (lastCandle.time === candleTime) {
          newCandles[lastIdx] = {
            ...lastCandle,
            high: Math.max(lastCandle.high, price),
            low: Math.min(lastCandle.low, price),
            close: price,
            volume: (lastCandle.volume || 0) + volume,
          }
        } else if (candleTime > lastCandle.time) {
          newCandles.push({
            time: candleTime,
            open: lastCandle.close,
            high: price, low: price, close: price,
            volume,
          })
          if (newCandles.length > MAX_CANDLES) newCandles.shift()
        }

        return newCandles
      })

      setCurrentCandle({
        time: candleTime,
        open: price, high: price, low: price, close: price,
        volume,
      })
    }

    wsRef.current = new WSClient({
      url: COINBASE_WS,
      onMessage: handleMessage,
      onStatusChange: setStatus,
      onConnect: () => {
        wsRef.current?.send(createSubscribeMessage(coinbaseSymbol))
      },
    })

    wsRef.current.connect()

    return () => {
      wsRef.current?.disconnect()
    }
  }, [coinbaseSymbol, interval, isCrypto])

  // Load more historical candles (for lazy loading on scroll)
  const loadMoreHistory = useCallback(async () => {
    const currentCandles = candlesRef.current
    if (isLoadingMore || !hasMoreHistory || currentCandles.length === 0) return
    if (currentCandles.length >= MAX_CANDLES) {
      setHasMoreHistory(false)
      return
    }

    setIsLoadingMore(true)
    try {
      const earliestCandle = currentCandles[0]

      if (isCrypto && COINBASE_INTERVALS.has(interval)) {
        // Crypto: Coinbase REST cursor-based pagination
        const endTime = earliestCandle.time
        const olderCandles = await fetchHistoricalCandles(coinbaseSymbol, interval, 300, endTime)

        if (olderCandles.length === 0) {
          setHasMoreHistory(false)
        } else {
          setCandles(prev => {
            const filteredOlder = olderCandles.filter(c => c.time < prev[0].time)
            const combined = [...filteredOlder, ...prev]
            if (combined.length > MAX_CANDLES) {
              return combined.slice(combined.length - MAX_CANDLES)
            }
            return combined
          })
        }
      } else {
        // Equity / non-Coinbase interval: fetch older date range via backend
        const earliestDate = new Date(earliestCandle.time * 1000)
        const end = earliestDate.toISOString().split('T')[0]
        // Go back further based on interval
        const daysBack = interval === '1m' || interval === '5m' ? 2
          : interval === '15m' || interval === '30m' ? 7
          : interval === '1h' || interval === '4h' ? 30
          : interval === '1d' ? 365
          : interval === '1wk' ? 3 * 365
          : 365
        const startDate = new Date(earliestDate.getTime() - daysBack * 86400000)
        const start = startDate.toISOString().split('T')[0]
        const apiSymbol = isCrypto ? coinbaseSymbol : symbol
        const res = await fetchOHLCV(apiSymbol, interval, start, end, equitySource)

        if (!res.data || res.data.length === 0) {
          setHasMoreHistory(false)
        } else {
          const olderCandles: Candle[] = res.data.map((d: { date: string; open: number; high: number; low: number; close: number; volume: number }) => ({
            time: Math.floor(new Date(d.date).getTime() / 1000),
            open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume,
          }))
          setCandles(prev => {
            if (prev.length === 0) return prev
            const filteredOlder = olderCandles.filter(c => c.time < prev[0].time)
            if (filteredOlder.length === 0) return prev
            const combined = [...filteredOlder, ...prev]
            if (combined.length > MAX_CANDLES) {
              return combined.slice(combined.length - MAX_CANDLES)
            }
            return combined
          })
          // Check if any new candles were actually added (use ref for latest state)
          // setHasMoreHistory(false) will be triggered on next call if no new data returned
        }
      }
    } catch (error) {
      console.error('Failed to load more history:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }, [coinbaseSymbol, symbol, interval, isLoadingMore, hasMoreHistory, isCrypto, equitySource])

  return { candles, currentCandle, status, symbol: isCrypto ? coinbaseSymbol : symbol, isCrypto, loadMoreHistory, isLoadingMore, hasMoreHistory }
}
