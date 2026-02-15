import { useEffect, useRef } from 'react'
import { createChart, CandlestickSeries, HistogramSeries, IChartApi, ISeriesApi, CrosshairMode, UTCTimestamp } from 'lightweight-charts'
import { useMarketData } from '../../hooks'
import { useSymbol } from '../../context'
import { LoadingOverlay } from '../ui'

export function LiveChart() {
  const { symbol: contextSymbol } = useSymbol()
  const { candles, status, symbol, loadMoreHistory, isLoadingMore } = useMarketData(contextSymbol, '1m')
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const lastCandleCountRef = useRef(0)
  const earliestTimeRef = useRef<number | null>(null) // Track earliest candle time for prepend detection

  // Reset chart tracking refs when symbol changes
  useEffect(() => {
    lastCandleCountRef.current = 0
    earliestTimeRef.current = null
  }, [contextSymbol])

  // Create chart on mount
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { color: '#0b0f19' },
        textColor: '#e8ecf4',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.06)' },
        horzLines: { color: 'rgba(255,255,255,0.06)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.06)',
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        timeVisible: true,
        secondsVisible: false,
      },
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    })

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [])

  // Update chart when candles change
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || candles.length === 0) return

    const currentEarliestTime = candles[0].time
    const isPrepending = earliestTimeRef.current !== null && currentEarliestTime < earliestTimeRef.current

    // If candle count changed significantly (initial load, reset, or prepend), set all data
    if (Math.abs(candles.length - lastCandleCountRef.current) > 5) {
      const chartCandles = candles.map(c => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))

      const chartVolume = candles.map(c => ({
        time: c.time as UTCTimestamp,
        value: c.volume ?? 0,
        color: c.close >= c.open ? '#22c55e80' : '#ef444480',
      }))

      candleSeriesRef.current.setData(chartCandles)
      volumeSeriesRef.current.setData(chartVolume)

      // Only fitContent on initial load, not when prepending older candles
      if (!isPrepending) {
        chartRef.current?.timeScale().fitContent()
      }

      lastCandleCountRef.current = candles.length
      earliestTimeRef.current = currentEarliestTime
    } else {
      // Incremental update - just update the last candle
      const lastCandle = candles[candles.length - 1]
      candleSeriesRef.current.update({
        time: lastCandle.time as UTCTimestamp,
        open: lastCandle.open,
        high: lastCandle.high,
        low: lastCandle.low,
        close: lastCandle.close,
      })
      volumeSeriesRef.current.update({
        time: lastCandle.time as UTCTimestamp,
        value: lastCandle.volume ?? 0,
        color: lastCandle.close >= lastCandle.open ? '#22c55e80' : '#ef444480',
      })
      lastCandleCountRef.current = candles.length
    }
  }, [candles])

  // Lazy load more history when user scrolls/zooms near left edge
  useEffect(() => {
    if (!chartRef.current) return

    const handleVisibleRangeChange = (range: { from: number; to: number } | null) => {
      if (!range) return
      // If user is within 10 bars of the left edge, load more
      if (range.from < 10 && !isLoadingMore) {
        loadMoreHistory()
      }
    }

    chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange)

    return () => {
      chartRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange)
    }
  }, [loadMoreHistory, isLoadingMore])

  // Calculate price info
  const latestPrice = candles[candles.length - 1]?.close
  const firstPrice = candles[0]?.open
  const priceChange = latestPrice && firstPrice ? latestPrice - firstPrice : 0
  const priceChangePercent = firstPrice ? (priceChange / firstPrice) * 100 : 0

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Status indicator - top left */}
      <div className="absolute top-2 left-2 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${
          status === 'connected' ? 'bg-[var(--green-up)]' :
          status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
          'bg-[var(--red-down)]'
        }`} />
        <span className="text-xs text-[var(--text-secondary)] font-mono">
          {status === 'connected' ? symbol : status}
        </span>
      </div>

      {/* Price display - top right */}
      {latestPrice && (
        <div className="absolute top-2 right-2 text-right">
          <div className="text-lg font-mono text-[var(--text-primary)]">
            ${latestPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`text-sm font-mono ${priceChange >= 0 ? 'text-[var(--green-up)]' : 'text-[var(--red-down)]'}`}>
            {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
          </div>
        </div>
      )}

      {/* Loading state */}
      {(status === 'connecting' || candles.length < 5) && (
        <LoadingOverlay message={status === 'connecting' ? 'Connecting to market data...' : 'Loading candles...'} />
      )}
    </div>
  )
}
