import { useEffect, useRef, useMemo } from 'react'
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, IChartApi, ISeriesApi, CrosshairMode, UTCTimestamp } from 'lightweight-charts'
import { useMarketData } from '../../hooks'
import { useIndicators, IndicatorData } from '../../hooks/useIndicators'
import { useMarketStats } from '../../hooks/useMarketStats'
import { useSymbol, useInterval } from '../../context'
import { LoadingOverlay } from '../ui'
import { ChartHeader, OHLCVData } from './ChartHeader'

export function LiveChart() {
  const { symbol: contextSymbol, setSymbol } = useSymbol()
  const { interval, setInterval } = useInterval()
  const { candles, status, loadMoreHistory, isLoadingMore } = useMarketData(contextSymbol, interval)
  const { stats: marketStats, loading: marketStatsLoading } = useMarketStats(contextSymbol)
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map())
  const lastCandleCountRef = useRef(0)
  const earliestTimeRef = useRef<number | null>(null)

  // Compute date range from candles for indicator fetching
  const dateRange = useMemo(() => {
    if (candles.length === 0) return { start: undefined, end: undefined }
    const startDate = new Date(candles[0].time * 1000).toISOString().split('T')[0]
    const endDate = new Date(candles[candles.length - 1].time * 1000).toISOString().split('T')[0]
    return { start: startDate, end: endDate }
  }, [candles.length > 0 ? candles[0].time : 0, candles.length > 0 ? candles[candles.length - 1].time : 0])

  // Use indicators hook
  const {
    selectedIds,
    toggleIndicator,
    activeIndicators,
    availableIndicators,
  } = useIndicators({
    symbol: contextSymbol,
    interval,
    startDate: dateRange.start,
    endDate: dateRange.end,
  })

  // Get latest candle OHLCV for header display
  const latestOHLCV = useMemo<OHLCVData | null>(() => {
    if (candles.length === 0) return null
    const last = candles[candles.length - 1]
    return {
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
      volume: last.volume,
      time: last.time,
    }
  }, [candles])

  // Reset chart tracking refs when symbol or interval changes
  useEffect(() => {
    lastCandleCountRef.current = 0
    earliestTimeRef.current = null
    // Clear indicator series
    indicatorSeriesRef.current.forEach((series) => {
      chartRef.current?.removeSeries(series)
    })
    indicatorSeriesRef.current.clear()
  }, [contextSymbol, interval])

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
      lastValueVisible: false, // Hide floating price label
      priceLineVisible: false, // Hide horizontal price line
    })

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      lastValueVisible: false,
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

  // Update indicator series when indicator data changes
  useEffect(() => {
    if (!chartRef.current) return

    // Remove series for deselected indicators
    indicatorSeriesRef.current.forEach((series, id) => {
      const baseId = id.split('-bb_')[0] // Handle bbands sub-series
      if (!selectedIds.includes(baseId) && !selectedIds.includes(id)) {
        chartRef.current?.removeSeries(series)
        indicatorSeriesRef.current.delete(id)
      }
    })

    // Add/update series for active indicators
    activeIndicators.forEach((indicator: IndicatorData) => {
      const { config, points } = indicator
      if (points.length === 0) return

      // Handle Bollinger Bands (multiple lines)
      if (config.name === 'bbands') {
        updateBollingerSeries(indicator)
        return
      }

      // Get or create series
      let series = indicatorSeriesRef.current.get(config.id)
      if (!series) {
        series = chartRef.current!.addSeries(LineSeries, {
          color: config.color,
          lineWidth: 1,
          priceScaleId: config.pane === 'separate' ? config.id : 'right',
          lastValueVisible: false,
          priceLineVisible: false,
          // Apply autoscale with bounds if specified
          ...(config.bounds && {
            autoscaleInfoProvider: () => ({
              priceRange: { minValue: config.bounds!.min, maxValue: config.bounds!.max },
            }),
          }),
        })

        if (config.pane === 'separate') {
          series.priceScale().applyOptions({
            scaleMargins: { top: 0.8, bottom: 0.02 },
          })
        }

        indicatorSeriesRef.current.set(config.id, series)
      }

      // Determine which value column to use
      const valueKey = getValueKey(config.name)
      const seriesData = points
        .filter(p => p[valueKey] !== undefined && p[valueKey] !== null)
        .map(p => ({
          time: Math.floor(new Date(p.date).getTime() / 1000) as UTCTimestamp,
          value: Number(p[valueKey]),
        }))

      if (seriesData.length > 0) {
        series.setData(seriesData)
      }
    })
  }, [activeIndicators, selectedIds])

  // Helper to get value column name for different indicators
  function getValueKey(indicatorName: string): string {
    switch (indicatorName) {
      case 'ema': return 'ema'
      case 'sma': return 'sma'
      case 'rsi': return 'rsi'
      case 'macd': return 'macd'
      case 'stoch': return 'stoch_k' // Primary stochastic line
      case 'atr': return 'atr'
      case 'adx': return 'adx'
      case 'vwap': return 'vwap'
      case 'obv': return 'obv'
      default: return 'value'
    }
  }

  // Handle Bollinger Bands (3 lines)
  function updateBollingerSeries(indicator: IndicatorData) {
    const { config, points } = indicator
    if (points.length === 0) return

    const bandKeys = ['bb_upper', 'bb_mid', 'bb_lower'] as const
    const bandColors = [config.color, config.color + '80', config.color]

    bandKeys.forEach((key, idx) => {
      const seriesId = `${config.id}-${key}`
      let series = indicatorSeriesRef.current.get(seriesId)

      if (!series) {
        series = chartRef.current!.addSeries(LineSeries, {
          color: bandColors[idx],
          lineWidth: 1,
          lineStyle: idx === 1 ? 2 : 0, // Dashed for middle
          priceScaleId: 'right',
          lastValueVisible: false,
          priceLineVisible: false,
        })
        indicatorSeriesRef.current.set(seriesId, series)
      }

      const seriesData = points
        .filter(p => p[key] !== undefined)
        .map(p => ({
          time: Math.floor(new Date(p.date).getTime() / 1000) as UTCTimestamp,
          value: Number(p[key]),
        }))

      if (seriesData.length > 0) {
        series.setData(seriesData)
      }
    })
  }

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

  return (
    <div className="flex flex-col w-full h-full">
      {/* Chart Header */}
      <ChartHeader
        symbol={contextSymbol}
        onSymbolChange={setSymbol}
        interval={interval}
        onIntervalChange={setInterval}
        indicators={availableIndicators}
        selectedIndicatorIds={selectedIds}
        onIndicatorToggle={toggleIndicator}
        ohlcv={latestOHLCV}
        marketStats={marketStats}
        marketStatsLoading={marketStatsLoading}
        disabled={status !== 'connected'}
      />

      {/* Chart Container */}
      <div className="relative flex-1">
        <div ref={containerRef} className="w-full h-full" />

        {/* Connection status indicator - small dot in corner */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${
            status === 'connected' ? 'bg-[var(--green-up)]' :
            status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
            'bg-[var(--red-down)]'
          }`} />
          <span className="text-xs text-[var(--text-tertiary)] font-mono">
            {status === 'connected' ? 'Live' : status}
          </span>
        </div>

        {/* Loading state */}
        {(status === 'connecting' || candles.length < 5) && (
          <LoadingOverlay message={status === 'connecting' ? 'Connecting to market data...' : 'Loading candles...'} />
        )}
      </div>
    </div>
  )
}
