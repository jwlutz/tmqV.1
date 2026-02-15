import { useEffect, useRef, useMemo, useState } from 'react'
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, IChartApi, ISeriesApi, CrosshairMode, UTCTimestamp } from 'lightweight-charts'
import { useMarketData, isCryptoSymbol } from '../../hooks'
import { useIndicators, IndicatorData } from '../../hooks/useIndicators'
import { useMarketStats } from '../../hooks/useMarketStats'
import { useSymbol, useInterval } from '../../context'
import { LoadingOverlay } from '../ui'
import { ChartHeader, OHLCVData } from './ChartHeader'
import { fetchOHLCV } from '../../api/client'

// Align comparison data to main chart timestamps using carry-forward for gaps
function alignComparisonData(
  mainTimestamps: number[],
  compareData: Array<{ time: UTCTimestamp; value: number }>
): Array<{ time: UTCTimestamp; value: number }> {
  if (compareData.length === 0 || mainTimestamps.length === 0) return []

  // Build a map of comparison values by timestamp
  const compareMap = new Map<number, number>()
  compareData.forEach(d => compareMap.set(d.time, d.value))

  // Sort comparison data to enable carry-forward
  const sortedCompare = [...compareData].sort((a, b) => a.time - b.time)

  const result: Array<{ time: UTCTimestamp; value: number }> = []
  let lastKnownValue: number | null = null
  let compareIdx = 0

  // For each main timestamp, find or interpolate comparison value
  for (const mainTime of mainTimestamps) {
    // Check exact match first
    if (compareMap.has(mainTime)) {
      lastKnownValue = compareMap.get(mainTime)!
      result.push({ time: mainTime as UTCTimestamp, value: lastKnownValue })
      continue
    }

    // Find the most recent comparison value before this timestamp
    while (
      compareIdx < sortedCompare.length &&
      sortedCompare[compareIdx].time <= mainTime
    ) {
      lastKnownValue = sortedCompare[compareIdx].value
      compareIdx++
    }

    // If we have a carry-forward value, use it
    if (lastKnownValue !== null) {
      result.push({ time: mainTime as UTCTimestamp, value: lastKnownValue })
    }
  }

  return result
}

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
  const compareSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const lastCandleCountRef = useRef(0)
  const earliestTimeRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null) // Track last timestamp to detect resets
  const isResettingRef = useRef(false)
  const chartDisposedRef = useRef(false) // Track if chart has been disposed

  // Comparison symbol state
  const [compareSymbol, setCompareSymbol] = useState<string | null>(null)
  const [compareData, setCompareData] = useState<Array<{ time: UTCTimestamp; value: number }>>([])
  const [, setCompareLoading] = useState(false)

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
    lastTimeRef.current = null
    isResettingRef.current = true // Flag that we're in a reset state

    // Skip chart operations if disposed or chart doesn't exist
    if (chartDisposedRef.current || !chartRef.current) return

    // Clear candle and volume series data to prevent stale data issues
    if (candleSeriesRef.current) {
      try {
        candleSeriesRef.current.setData([])
      } catch { /* ignore */ }
    }
    if (volumeSeriesRef.current) {
      try {
        volumeSeriesRef.current.setData([])
      } catch { /* ignore */ }
    }

    // Clear indicator series - collect valid series first, then remove
    const seriesToRemove: Array<{ id: string; series: ISeriesApi<'Line'> }> = []
    indicatorSeriesRef.current.forEach((series, id) => {
      seriesToRemove.push({ id, series })
    })

    // Clear the map first to prevent re-iteration issues
    indicatorSeriesRef.current.clear()

    // Now remove from chart
    const chart = chartRef.current
    for (const { series } of seriesToRemove) {
      try {
        // Check if chart still has this series before removing
        if (chart && !chartDisposedRef.current) {
          chart.removeSeries(series)
        }
      } catch { /* ignore - series may already be removed or chart disposed */ }
    }
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
    chartDisposedRef.current = false // Chart is now active

    const handleResize = () => {
      if (containerRef.current && chartRef.current && !chartDisposedRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      chartDisposedRef.current = true // Mark as disposed before cleanup
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [])

  // Update chart when candles change
  useEffect(() => {
    if (chartDisposedRef.current) return // Skip if chart is disposed
    if (!candleSeriesRef.current || !volumeSeriesRef.current || candles.length === 0) return

    const currentEarliestTime = candles[0].time
    const currentLatestTime = candles[candles.length - 1].time
    const isPrepending = earliestTimeRef.current !== null && currentEarliestTime < earliestTimeRef.current

    // Detect if this is a reset: timestamps went backwards or we flagged a reset
    const isReset = isResettingRef.current ||
      (lastTimeRef.current !== null && currentLatestTime < lastTimeRef.current) ||
      Math.abs(candles.length - lastCandleCountRef.current) > 5

    try {
      if (isReset) {
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
        lastTimeRef.current = currentLatestTime
        isResettingRef.current = false // Clear reset flag
      } else {
        // Incremental update - just update the last candle
        const lastCandle = candles[candles.length - 1]

        // Safety check: only update if new timestamp >= last timestamp
        if (lastTimeRef.current === null || lastCandle.time >= lastTimeRef.current) {
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
          lastTimeRef.current = lastCandle.time
        }
      }
    } catch (e) {
      // If update fails, force a full reset on next render
      console.warn('Chart update failed, will reset:', e)
      isResettingRef.current = true
    }
  }, [candles])

  // Update indicator series when indicator data changes
  useEffect(() => {
    if (chartDisposedRef.current || !chartRef.current) return

    const chart = chartRef.current

    // Remove series for deselected indicators - collect IDs first to avoid modifying while iterating
    const idsToRemove: string[] = []
    // Multi-line indicator suffixes to strip when checking base ID
    const multiLineSuffixes = ['-bb_', '-kc_', '-dc_', '-ichimoku_']
    indicatorSeriesRef.current.forEach((_series, id) => {
      // Extract base ID by removing multi-line suffixes
      let baseId = id
      for (const suffix of multiLineSuffixes) {
        const idx = id.indexOf(suffix)
        if (idx !== -1) {
          baseId = id.slice(0, idx)
          break
        }
      }
      if (!selectedIds.includes(baseId) && !selectedIds.includes(id)) {
        idsToRemove.push(id)
      }
    })

    // Now remove the collected series
    for (const id of idsToRemove) {
      const series = indicatorSeriesRef.current.get(id)
      if (series && chart && !chartDisposedRef.current) {
        try {
          chart.removeSeries(series)
        } catch { /* ignore - chart may be disposed */ }
      }
      indicatorSeriesRef.current.delete(id)
    }

    // Add/update series for active indicators
    activeIndicators.forEach((indicator: IndicatorData) => {
      // Re-check disposal state inside loop
      if (chartDisposedRef.current || !chart) return

      const { config, points } = indicator
      if (points.length === 0) return

      // Handle multi-line indicators (bands/channels)
      if (isMultiLineIndicator(config.name)) {
        updateMultiLineSeries(indicator)
        return
      }

      // Get or create series
      let series = indicatorSeriesRef.current.get(config.id)
      if (!series) {
        try {
          series = chart.addSeries(LineSeries, {
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

          // Add horizontal reference lines at configured levels
          if (config.levels) {
            config.levels.forEach(level => {
              series!.createPriceLine({
                price: level,
                color: 'rgba(255, 255, 255, 0.3)',
                lineWidth: 1,
                lineStyle: 2, // Dashed
                axisLabelVisible: true,
                title: '',
              })
            })
          }

          indicatorSeriesRef.current.set(config.id, series)
        } catch (e) {
          console.warn(`Failed to create indicator series for ${config.id}:`, e)
          return
        }
      }

      // Determine which value column to use
      const valueKey = getValueKey(config.name)
      const seriesData = points
        .filter(p => p[valueKey] !== undefined && p[valueKey] !== null)
        .map(p => ({
          time: Math.floor(new Date(p.date).getTime() / 1000) as UTCTimestamp,
          value: Number(p[valueKey]),
        }))
        // Sort by time and deduplicate (keep last value for each timestamp)
        .sort((a, b) => a.time - b.time)
        .filter((item, idx, arr) => idx === arr.length - 1 || item.time !== arr[idx + 1].time)

      if (seriesData.length > 0) {
        try {
          series.setData(seriesData)
        } catch (e) {
          console.warn(`Failed to set indicator data for ${config.id}:`, e)
        }
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
      case 'stoch': return 'stoch_k'
      case 'stochrsi': return 'stochrsi_k'
      case 'atr': return 'atr'
      case 'adx': return 'adx'
      case 'vwap': return 'vwap'
      case 'obv': return 'obv'
      case 'mfi': return 'mfi'
      case 'cci': return 'cci'
      case 'willr': return 'willr'
      case 'cmf': return 'cmf'
      case 'roc': return 'roc'
      case 'trix': return 'trix'
      case 'ppo': return 'ppo'
      case 'aroon': return 'aroon_up'
      case 'supertrend': return 'supertrend'
      case 'psar': return 'psar_long' // Use long position values
      default: return 'value'
    }
  }

  // Check if indicator needs multi-line handling
  function isMultiLineIndicator(name: string): boolean {
    return ['bbands', 'kc', 'donchian', 'ichimoku'].includes(name)
  }

  // Multi-line indicator configs: keys and line styles
  const MULTI_LINE_CONFIG: Record<string, { keys: string[]; styles: Array<{ dashed?: boolean; alpha?: string }> }> = {
    bbands: {
      keys: ['bb_upper', 'bb_mid', 'bb_lower'],
      styles: [{}, { dashed: true, alpha: '80' }, {}],
    },
    kc: {
      keys: ['kc_upper', 'kc_basis', 'kc_lower'],
      styles: [{}, { dashed: true, alpha: '80' }, {}],
    },
    donchian: {
      keys: ['dc_upper', 'dc_mid', 'dc_lower'],
      styles: [{}, { dashed: true, alpha: '80' }, {}],
    },
    ichimoku: {
      keys: ['ichimoku_tenkan', 'ichimoku_kijun', 'ichimoku_span_a', 'ichimoku_span_b'],
      styles: [
        { alpha: 'ff' },  // Tenkan (conversion) - solid
        { alpha: 'cc' },  // Kijun (base) - slightly transparent
        { alpha: '99' },  // Span A - more transparent
        { alpha: '66' },  // Span B - most transparent
      ],
    },
  }

  // Handle multi-line indicators (bands, channels, ichimoku)
  function updateMultiLineSeries(indicator: IndicatorData) {
    if (chartDisposedRef.current || !chartRef.current) return

    const { config, points } = indicator
    if (points.length === 0) return

    const chart = chartRef.current
    const lineConfig = MULTI_LINE_CONFIG[config.name]
    if (!lineConfig) return

    lineConfig.keys.forEach((key, idx) => {
      if (chartDisposedRef.current) return

      const seriesId = `${config.id}-${key}`
      let series = indicatorSeriesRef.current.get(seriesId)
      const style = lineConfig.styles[idx] || {}
      const color = style.alpha ? config.color + style.alpha : config.color

      if (!series) {
        try {
          series = chart.addSeries(LineSeries, {
            color,
            lineWidth: 1,
            lineStyle: style.dashed ? 2 : 0,
            priceScaleId: 'right',
            lastValueVisible: false,
            priceLineVisible: false,
          })
          indicatorSeriesRef.current.set(seriesId, series)
        } catch (e) {
          console.warn(`Failed to create ${config.name} series:`, e)
          return
        }
      }

      const seriesData = points
        .filter(p => p[key] !== undefined)
        .map(p => ({
          time: Math.floor(new Date(p.date).getTime() / 1000) as UTCTimestamp,
          value: Number(p[key]),
        }))
        .sort((a, b) => a.time - b.time)
        .filter((item, idx, arr) => idx === arr.length - 1 || item.time !== arr[idx + 1].time)

      if (seriesData.length > 0) {
        try {
          series.setData(seriesData)
        } catch (e) {
          console.warn(`Failed to set ${config.name} data:`, e)
        }
      }
    })
  }

  // Fetch comparison symbol data
  useEffect(() => {
    if (!compareSymbol || !dateRange.start || !dateRange.end) {
      setCompareData([])
      return
    }

    let cancelled = false
    setCompareLoading(true)

    async function fetchCompare() {
      try {
        // Convert symbol format if needed (BTC-USD -> BTC/USD for backend)
        const apiSymbol = compareSymbol!.replace('-', '/')
        const res = await fetchOHLCV(apiSymbol, interval, dateRange.start!, dateRange.end!)
        if (cancelled) return

        if (res.data?.length > 0) {
          // Convert to line series data
          const rawData = res.data.map((d: { date: string; close: number }) => ({
            time: Math.floor(new Date(d.date).getTime() / 1000) as UTCTimestamp,
            value: d.close,
          }))

          // Detect if we need gap alignment (crypto main + equity compare or vice versa)
          const mainIsCrypto = isCryptoSymbol(contextSymbol)
          const compareIsCrypto = isCryptoSymbol(compareSymbol!)

          // If mixing crypto (24/7) with equity (business days), align to main chart timestamps
          if (mainIsCrypto !== compareIsCrypto && candles.length > 0) {
            const mainTimestamps = candles.map(c => c.time)
            const alignedData = alignComparisonData(mainTimestamps, rawData)
            setCompareData(alignedData)
          } else {
            setCompareData(rawData)
          }
        }
      } catch (err) {
        console.warn('Failed to fetch comparison data:', err)
        setCompareData([])
      } finally {
        if (!cancelled) setCompareLoading(false)
      }
    }

    fetchCompare()
    return () => { cancelled = true }
  }, [compareSymbol, interval, dateRange.start, dateRange.end, contextSymbol, candles])

  // Render comparison series on chart
  useEffect(() => {
    if (chartDisposedRef.current || !chartRef.current) return
    const chart = chartRef.current

    // Remove existing comparison series if no compare symbol
    if (!compareSymbol && compareSeriesRef.current) {
      try {
        chart.removeSeries(compareSeriesRef.current)
      } catch { /* ignore */ }
      compareSeriesRef.current = null
      return
    }

    if (!compareSymbol || compareData.length === 0) return

    // Create comparison series if needed
    if (!compareSeriesRef.current) {
      try {
        compareSeriesRef.current = chart.addSeries(LineSeries, {
          color: '#fbbf24', // Amber/gold color
          lineWidth: 2,
          priceScaleId: 'left', // Separate Y-axis on left
          lastValueVisible: true,
          priceLineVisible: false,
          title: compareSymbol,
        })
        // Configure left price scale
        chart.priceScale('left').applyOptions({
          visible: true,
          borderColor: 'rgba(255, 191, 36, 0.3)',
        })
      } catch (e) {
        console.warn('Failed to create comparison series:', e)
        return
      }
    }

    // Update data
    try {
      compareSeriesRef.current.setData(compareData)
    } catch (e) {
      console.warn('Failed to set comparison data:', e)
    }
  }, [compareSymbol, compareData])

  // Clear comparison series when symbol changes
  useEffect(() => {
    if (compareSeriesRef.current && chartRef.current && !chartDisposedRef.current) {
      try {
        chartRef.current.removeSeries(compareSeriesRef.current)
      } catch { /* ignore */ }
      compareSeriesRef.current = null
    }
    setCompareSymbol(null)
    setCompareData([])
  }, [contextSymbol])

  // Lazy load more history when user scrolls/zooms near left edge
  useEffect(() => {
    if (chartDisposedRef.current || !chartRef.current) return

    const chart = chartRef.current
    let timeScale: ReturnType<typeof chart.timeScale> | null = null

    try {
      timeScale = chart.timeScale()
    } catch {
      return // Chart may be disposed
    }

    const handleVisibleRangeChange = (range: { from: number; to: number } | null) => {
      if (!range || chartDisposedRef.current) return
      // If user is within 10 bars of the left edge, load more
      if (range.from < 10 && !isLoadingMore) {
        loadMoreHistory()
      }
    }

    timeScale.subscribeVisibleLogicalRangeChange(handleVisibleRangeChange)

    return () => {
      try {
        timeScale?.unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange)
      } catch { /* ignore - chart may be disposed */ }
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
        compareSymbol={compareSymbol}
        onCompareSymbolChange={setCompareSymbol}
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
