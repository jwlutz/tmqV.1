import { useEffect, useRef, useMemo, useState } from 'react'
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, IChartApi, ISeriesApi, CrosshairMode, UTCTimestamp } from 'lightweight-charts'
import { useMarketData } from '../hooks'
import { useIndicators } from '../hooks/useIndicators'
import type { IndicatorResult, IndicatorConfig, CustomIndicator } from '../hooks/useIndicators'
import { useMarketStats } from '../hooks/useMarketStats'
import { useDataSettings } from '../context'
import { LoadingOverlay } from '../components/ui'
import { formatPrice, formatNumber } from '../hooks/useMarketStats'
import { fetchOHLCV } from '../api/client'
import type { MacroOverlay } from '../context'

export interface CandlestickIndicatorInfo {
  selectedIds: string[]
  availableIndicators: IndicatorConfig[]
  indicatorCategories: Record<string, IndicatorConfig[]>
  toggleIndicator: (id: string) => void
  activeIndicators: IndicatorResult[]
  showVolume: boolean
  toggleVolume: () => void
  customIndicators: CustomIndicator[]
  addCustomIndicator: (indicator: CustomIndicator) => void
  removeCustomIndicator: (id: string) => void
}

export interface CandlestickWidgetProps {
  paneId: string
  symbol: string
  interval: string
  macroOverlays: MacroOverlay[]
  compareSymbol: string | null
  onCompareSymbolChange: (sym: string | null) => void
  onStatusChange?: (status: string) => void
  onIndicatorsReady?: (info: CandlestickIndicatorInfo) => void
}

// Plot color variants for multi-plot indicators
const MULTI_PLOT_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4']

export function CandlestickWidget({
  symbol,
  interval,
  macroOverlays = [],
  compareSymbol,
  onCompareSymbolChange,
  onStatusChange,
  onIndicatorsReady,
}: CandlestickWidgetProps) {
  const { candles, status, isCrypto, loadMoreHistory, isLoadingMore } = useMarketData(symbol, interval)
  const { stats: marketStats } = useMarketStats(symbol)
  const { providerCredentials } = useDataSettings()

  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map())
  const compareSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const macroSeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map())
  const lastCandleCountRef = useRef(0)
  const earliestTimeRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)
  const isResettingRef = useRef(false)
  const chartDisposedRef = useRef(false)

  const [compareData, setCompareData] = useState<Array<{ time: UTCTimestamp; value: number }>>([])
  const [mainPctData, setMainPctData] = useState<Array<{ time: UTCTimestamp; value: number }>>([])
  const [, setCompareLoading] = useState(false)
  const mainPctSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  const hasAlpaca = !!providerCredentials.alpaca?.apiKey
  const showDelayedBanner = !isCrypto && !hasAlpaca

  // Compute date range from candles for indicator fetching
  const dateRange = useMemo(() => {
    if (candles.length === 0) return { start: undefined, end: undefined }
    const startDate = new Date(candles[0].time * 1000).toISOString().split('T')[0]
    const endDate = new Date(candles[candles.length - 1].time * 1000).toISOString().split('T')[0]
    return { start: startDate, end: endDate }
  }, [candles.length > 0 ? candles[0].time : 0, candles.length > 0 ? candles[candles.length - 1].time : 0])

  const {
    selectedIds,
    toggleIndicator,
    activeIndicators,
    availableIndicators,
    indicatorCategories,
    showVolume,
    toggleVolume,
    customIndicators,
    addCustomIndicator,
    removeCustomIndicator,
  } = useIndicators({ candles })

  // Use refs for callbacks to avoid including them in effect deps
  const onIndicatorsReadyRef = useRef(onIndicatorsReady)
  onIndicatorsReadyRef.current = onIndicatorsReady
  const onStatusChangeRef = useRef(onStatusChange)
  onStatusChangeRef.current = onStatusChange

  // Bubble indicator info up to ChartPane for header chips/dropdown
  useEffect(() => {
    onIndicatorsReadyRef.current?.({
      selectedIds, availableIndicators, indicatorCategories, toggleIndicator,
      activeIndicators, showVolume, toggleVolume,
      customIndicators, addCustomIndicator, removeCustomIndicator,
    })
  }, [selectedIds, availableIndicators, indicatorCategories, toggleIndicator,
      activeIndicators, showVolume, toggleVolume,
      customIndicators, addCustomIndicator, removeCustomIndicator])

  // Bubble status up to ChartPane for connection dot
  useEffect(() => {
    onStatusChangeRef.current?.(status)
  }, [status])

  const latestCandle = candles.length > 0 ? candles[candles.length - 1] : null
  const changeFromOpen = latestCandle ? latestCandle.close - latestCandle.open : null
  const changePctFromOpen = latestCandle && latestCandle.open !== 0
    ? ((latestCandle.close - latestCandle.open) / latestCandle.open) * 100
    : null

  // Reset chart tracking refs when symbol or interval changes
  useEffect(() => {
    lastCandleCountRef.current = 0
    earliestTimeRef.current = null
    lastTimeRef.current = null
    isResettingRef.current = true

    if (chartDisposedRef.current || !chartRef.current) return

    if (candleSeriesRef.current) {
      try { candleSeriesRef.current.setData([]) } catch { /* ignore */ }
    }
    if (volumeSeriesRef.current) {
      try { volumeSeriesRef.current.setData([]) } catch { /* ignore */ }
    }

    const seriesToRemove: Array<{ id: string; series: ISeriesApi<'Line'> }> = []
    indicatorSeriesRef.current.forEach((series, id) => {
      seriesToRemove.push({ id, series })
    })
    indicatorSeriesRef.current.clear()

    const chart = chartRef.current
    for (const { series } of seriesToRemove) {
      try {
        if (chart && !chartDisposedRef.current) {
          chart.removeSeries(series)
        }
      } catch { /* ignore */ }
    }
  }, [symbol, interval])

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
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
      leftPriceScale: {
        visible: false,
        borderColor: 'rgba(59, 130, 246, 0.3)',
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
      lastValueVisible: false,
      priceLineVisible: false,
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
    chartDisposedRef.current = false

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current && !chartDisposedRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    })
    ro.observe(containerRef.current)

    return () => {
      chartDisposedRef.current = true
      ro.disconnect()
      chart.remove()
    }
  }, [])

  // Update chart when candles change
  useEffect(() => {
    if (chartDisposedRef.current) return
    if (!candleSeriesRef.current || !volumeSeriesRef.current || candles.length === 0) return

    const currentEarliestTime = candles[0].time
    const currentLatestTime = candles[candles.length - 1].time
    const isPrepending = earliestTimeRef.current !== null && currentEarliestTime < earliestTimeRef.current

    const isReset = isResettingRef.current ||
      (lastTimeRef.current !== null && currentLatestTime < lastTimeRef.current) ||
      Math.abs(candles.length - lastCandleCountRef.current) > 5

    try {
      if (isReset) {
        const chartCandles = candles.map(c => ({
          time: c.time as UTCTimestamp,
          open: c.open, high: c.high, low: c.low, close: c.close,
        }))
        const chartVolume = candles.map(c => ({
          time: c.time as UTCTimestamp,
          value: c.volume ?? 0,
          color: c.close >= c.open ? '#22c55e80' : '#ef444480',
        }))

        candleSeriesRef.current.setData(chartCandles)
        if (showVolume) {
          volumeSeriesRef.current.setData(chartVolume)
        } else {
          volumeSeriesRef.current.setData([])
        }

        if (!isPrepending) {
          chartRef.current?.timeScale().fitContent()
        }

        lastCandleCountRef.current = candles.length
        earliestTimeRef.current = currentEarliestTime
        lastTimeRef.current = currentLatestTime
        isResettingRef.current = false
      } else {
        const lastCandle = candles[candles.length - 1]
        if (lastTimeRef.current === null || lastCandle.time >= lastTimeRef.current) {
          candleSeriesRef.current.update({
            time: lastCandle.time as UTCTimestamp,
            open: lastCandle.open, high: lastCandle.high,
            low: lastCandle.low, close: lastCandle.close,
          })
          if (showVolume) {
            volumeSeriesRef.current.update({
              time: lastCandle.time as UTCTimestamp,
              value: lastCandle.volume ?? 0,
              color: lastCandle.close >= lastCandle.open ? '#22c55e80' : '#ef444480',
            })
          }
          lastCandleCountRef.current = candles.length
          lastTimeRef.current = lastCandle.time
        }
      }
    } catch (e) {
      console.warn('Chart update failed, will reset:', e)
      isResettingRef.current = true
    }
  }, [candles, showVolume])

  // Toggle volume visibility
  useEffect(() => {
    if (chartDisposedRef.current || !volumeSeriesRef.current) return
    if (!showVolume) {
      try { volumeSeriesRef.current.setData([]) } catch { /* ignore */ }
    } else if (candles.length > 0) {
      const chartVolume = candles.map(c => ({
        time: c.time as UTCTimestamp,
        value: c.volume ?? 0,
        color: c.close >= c.open ? '#22c55e80' : '#ef444480',
      }))
      try { volumeSeriesRef.current.setData(chartVolume) } catch { /* ignore */ }
    }
  }, [showVolume])

  // Update indicator series
  useEffect(() => {
    if (chartDisposedRef.current || !chartRef.current) return
    const chart = chartRef.current

    // Build set of all series keys that should be active
    const activeSeriesKeys = new Set<string>()
    activeIndicators.forEach(result => {
      for (const plotKey of Object.keys(result.plots)) {
        activeSeriesKeys.add(`${result.config.id}:${plotKey}`)
      }
    })

    // Remove deselected series
    const idsToRemove: string[] = []
    indicatorSeriesRef.current.forEach((_series, seriesKey) => {
      const indicatorId = seriesKey.split(':')[0]
      if (!selectedIds.includes(indicatorId) && !activeSeriesKeys.has(seriesKey)) {
        idsToRemove.push(seriesKey)
      }
    })
    for (const id of idsToRemove) {
      const series = indicatorSeriesRef.current.get(id)
      if (series && chart && !chartDisposedRef.current) {
        try { chart.removeSeries(series) } catch { /* ignore */ }
      }
      indicatorSeriesRef.current.delete(id)
    }

    // Add/update active indicators
    activeIndicators.forEach((result: IndicatorResult) => {
      if (chartDisposedRef.current || !chart) return
      const { config, plots } = result
      const plotEntries = Object.entries(plots)
      const isMultiPlot = plotEntries.length > 1

      plotEntries.forEach(([plotKey, points], plotIdx) => {
        if (points.length === 0) return
        const seriesKey = `${config.id}:${plotKey}`

        let series = indicatorSeriesRef.current.get(seriesKey)
        if (!series) {
          try {
            // For multi-plot indicators, cycle through colors
            const plotColor = isMultiPlot
              ? MULTI_PLOT_COLORS[plotIdx % MULTI_PLOT_COLORS.length]
              : config.color

            series = chart.addSeries(LineSeries, {
              color: plotColor,
              lineWidth: 1,
              priceScaleId: config.pane === 'separate' ? config.id : 'right',
              lastValueVisible: false,
              priceLineVisible: false,
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
            // Only add levels for the first plot of an indicator
            if (plotIdx === 0 && config.levels) {
              config.levels.forEach(level => {
                series!.createPriceLine({
                  price: level,
                  color: 'rgba(255, 255, 255, 0.3)',
                  lineWidth: 1,
                  lineStyle: 2,
                  axisLabelVisible: true,
                  title: '',
                })
              })
            }
            indicatorSeriesRef.current.set(seriesKey, series)
          } catch (e) {
            console.warn(`Failed to create indicator series for ${seriesKey}:`, e)
            return
          }
        }

        // Sort and deduplicate
        const seriesData = points
          .sort((a, b) => a.time - b.time)
          .filter((item, idx, arr) => idx === arr.length - 1 || item.time !== arr[idx + 1].time)
          .map(p => ({ time: p.time as UTCTimestamp, value: p.value }))

        if (seriesData.length > 0) {
          try { series.setData(seriesData) } catch (e) {
            console.warn(`Failed to set indicator data for ${seriesKey}:`, e)
          }
        }
      })
    })
  }, [activeIndicators, selectedIds])

  // Lazy load more history
  useEffect(() => {
    if (chartDisposedRef.current || !chartRef.current) return
    const chart = chartRef.current
    let timeScale: ReturnType<typeof chart.timeScale> | null = null
    try { timeScale = chart.timeScale() } catch { return }

    const handleVisibleRangeChange = (range: { from: number; to: number } | null) => {
      if (!range || chartDisposedRef.current) return
      if (range.from < 10 && !isLoadingMore) {
        loadMoreHistory()
      }
    }

    timeScale.subscribeVisibleLogicalRangeChange(handleVisibleRangeChange)
    return () => {
      try { timeScale?.unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange) } catch { /* ignore */ }
    }
  }, [loadMoreHistory, isLoadingMore])

  // Fetch comparison symbol data and compute percent changes
  useEffect(() => {
    if (!compareSymbol || !dateRange.start || !dateRange.end) {
      setCompareData([])
      setMainPctData([])
      return
    }

    let cancelled = false
    setCompareLoading(true)

    async function fetchCompare() {
      try {
        const apiSymbol = compareSymbol!.replace('-', '/')
        const res = await fetchOHLCV(apiSymbol, interval, dateRange.start!, dateRange.end!)
        if (cancelled) return

        if (res.data?.length > 0 && candles.length > 0) {
          const compareDateMap = new Map<string, number>()
          res.data.forEach((d: { date: string; close: number }) => {
            compareDateMap.set(d.date, d.close)
          })

          const aligned: Array<{ time: UTCTimestamp; value: number }> = []
          let lastValue: number | null = null

          for (const candle of candles) {
            const mainDateStr = new Date(candle.time * 1000).toISOString().split('T')[0]

            if (compareDateMap.has(mainDateStr)) {
              lastValue = compareDateMap.get(mainDateStr)!
              aligned.push({ time: candle.time as UTCTimestamp, value: lastValue })
            } else if (lastValue !== null) {
              aligned.push({ time: candle.time as UTCTimestamp, value: lastValue })
            }
          }

          if (aligned.length > 0) {
            const baselineCompare = aligned[0].value
            const baselineMain = candles[0].close

            const comparePct = aligned.map(d => ({
              time: d.time,
              value: ((d.value - baselineCompare) / baselineCompare) * 100
            }))

            const mainPct = candles.map(c => ({
              time: c.time as UTCTimestamp,
              value: ((c.close - baselineMain) / baselineMain) * 100
            }))

            setCompareData(comparePct)
            setMainPctData(mainPct)
          }
        }
      } catch (err) {
        console.warn('Failed to fetch comparison data:', err)
        setCompareData([])
        setMainPctData([])
      } finally {
        if (!cancelled) setCompareLoading(false)
      }
    }

    fetchCompare()
    return () => { cancelled = true }
  }, [compareSymbol, interval, dateRange.start, dateRange.end, symbol, candles])

  const compareSymbolForSeriesRef = useRef<string | null>(null)

  // Render comparison series with percent change on left Y-axis
  useEffect(() => {
    if (chartDisposedRef.current || !chartRef.current) return
    const chart = chartRef.current

    if (!compareSymbol) {
      if (compareSeriesRef.current) {
        try { chart.removeSeries(compareSeriesRef.current) } catch { /* ignore */ }
        compareSeriesRef.current = null
        compareSymbolForSeriesRef.current = null
      }
      if (mainPctSeriesRef.current) {
        try { chart.removeSeries(mainPctSeriesRef.current) } catch { /* ignore */ }
        mainPctSeriesRef.current = null
      }
      try {
        chart.applyOptions({ leftPriceScale: { visible: false } })
      } catch { /* ignore */ }
      return
    }

    if (compareSeriesRef.current && compareSymbolForSeriesRef.current !== compareSymbol) {
      try { chart.removeSeries(compareSeriesRef.current) } catch { /* ignore */ }
      compareSeriesRef.current = null
    }

    if (compareData.length === 0 || mainPctData.length === 0) return

    if (!mainPctSeriesRef.current) {
      try {
        mainPctSeriesRef.current = chart.addSeries(LineSeries, {
          color: '#3b82f6',
          lineWidth: 2,
          priceScaleId: 'left',
          lastValueVisible: true,
          priceLineVisible: false,
          title: symbol,
          priceFormat: {
            type: 'custom',
            formatter: (price: number) => `${price >= 0 ? '+' : ''}${price.toFixed(1)}%`,
          },
        })
        mainPctSeriesRef.current.priceScale().applyOptions({
          scaleMargins: { top: 0.1, bottom: 0.2 },
          borderColor: 'rgba(59, 130, 246, 0.5)',
        })
      } catch (e) {
        console.warn('Failed to create main pct series:', e)
      }
    }

    if (!compareSeriesRef.current) {
      try {
        compareSeriesRef.current = chart.addSeries(LineSeries, {
          color: '#fbbf24',
          lineWidth: 2,
          priceScaleId: 'left',
          lastValueVisible: true,
          priceLineVisible: false,
          title: compareSymbol,
          priceFormat: {
            type: 'custom',
            formatter: (price: number) => `${price >= 0 ? '+' : ''}${price.toFixed(1)}%`,
          },
        })
        compareSymbolForSeriesRef.current = compareSymbol
      } catch (e) {
        console.warn('Failed to create comparison series:', e)
        return
      }
    }

    try {
      mainPctSeriesRef.current?.setData(mainPctData)
      compareSeriesRef.current.setData(compareData)
      chart.applyOptions({ leftPriceScale: { visible: true } })
    } catch (e) {
      console.warn('Failed to set comparison data:', e)
    }
  }, [compareSymbol, compareData, mainPctData, symbol])

  // Clear comparison when main symbol changes
  useEffect(() => {
    if (!compareSeriesRef.current && !compareSymbol) return

    if (chartRef.current && !chartDisposedRef.current) {
      if (compareSeriesRef.current) {
        try { chartRef.current.removeSeries(compareSeriesRef.current) } catch { /* ignore */ }
        compareSeriesRef.current = null
        compareSymbolForSeriesRef.current = null
      }
      if (mainPctSeriesRef.current) {
        try { chartRef.current.removeSeries(mainPctSeriesRef.current) } catch { /* ignore */ }
        mainPctSeriesRef.current = null
      }
      try {
        chartRef.current.applyOptions({ leftPriceScale: { visible: false } })
      } catch { /* ignore */ }
    }
    onCompareSymbolChange(null)
    setCompareData([])
    setMainPctData([])
  }, [symbol])

  // Render macro overlay series on separate 'macro' price scale
  useEffect(() => {
    if (chartDisposedRef.current || !chartRef.current) return
    const chart = chartRef.current

    const activeOverlayIds = new Set(macroOverlays.map(o => o.id))
    const toRemove: string[] = []
    macroSeriesRef.current.forEach((_series, id) => {
      if (!activeOverlayIds.has(id)) {
        toRemove.push(id)
      }
    })
    for (const id of toRemove) {
      const series = macroSeriesRef.current.get(id)
      if (series && chart && !chartDisposedRef.current) {
        try { chart.removeSeries(series) } catch { /* ignore */ }
      }
      macroSeriesRef.current.delete(id)
    }

    macroOverlays.forEach((overlay) => {
      if (chartDisposedRef.current || !chart || overlay.data.length === 0) return

      let series = macroSeriesRef.current.get(overlay.id)
      if (!series) {
        try {
          series = chart.addSeries(LineSeries, {
            color: overlay.color,
            lineWidth: 2,
            priceScaleId: 'macro',
            lastValueVisible: true,
            priceLineVisible: false,
            title: overlay.seriesId,
            priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
          })
          chart.priceScale('macro').applyOptions({
            scaleMargins: { top: 0.1, bottom: 0.2 },
          })
          macroSeriesRef.current.set(overlay.id, series)
        } catch (e) {
          console.warn(`Failed to create macro series for ${overlay.seriesId}:`, e)
          return
        }
      }

      const seriesData = overlay.data
        .filter(p => p.value !== null && p.value !== undefined)
        .map(p => ({
          time: Math.floor(new Date(p.date).getTime() / 1000) as UTCTimestamp,
          value: Number(p.value),
        }))
        .sort((a, b) => a.time - b.time)
        .filter((item, idx, arr) => idx === arr.length - 1 || item.time !== arr[idx + 1].time)

      if (seriesData.length > 0) {
        try { series.setData(seriesData) } catch (e) {
          console.warn(`Failed to set macro data for ${overlay.seriesId}:`, e)
        }
      }
    })
  }, [macroOverlays])

  // Clean up macro series when symbol changes
  useEffect(() => {
    if (!chartRef.current || chartDisposedRef.current) return
    const chart = chartRef.current
    macroSeriesRef.current.forEach((series) => {
      try { chart.removeSeries(series) } catch { /* ignore */ }
    })
    macroSeriesRef.current.clear()
  }, [symbol])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Stats bar */}
      {latestCandle && (
        <div className="flex items-center gap-3 px-2 py-0.5 bg-[var(--bg-dark)] border-b border-[var(--border)] text-[11px] font-mono flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {formatPrice(latestCandle.close)}
            </span>
            {changeFromOpen !== null && changePctFromOpen !== null && (
              <span className={changeFromOpen >= 0 ? 'text-[var(--green-up)]' : 'text-[var(--red-down)]'}>
                {changeFromOpen >= 0 ? '+' : '-'}{formatPrice(Math.abs(changeFromOpen))}
                {' '}({changePctFromOpen >= 0 ? '+' : ''}{changePctFromOpen.toFixed(2)}%)
              </span>
            )}
          </div>

          <span className="text-[var(--border)]">|</span>

          <div className="flex items-center gap-1">
            <span className="text-[var(--text-tertiary)]">O</span>
            <span className="text-[var(--text-primary)]">{formatPrice(latestCandle.open)}</span>
            <span className="text-[var(--text-tertiary)]">H</span>
            <span className="text-[var(--green-up)]">{formatPrice(latestCandle.high)}</span>
            <span className="text-[var(--text-tertiary)]">L</span>
            <span className="text-[var(--red-down)]">{formatPrice(latestCandle.low)}</span>
          </div>

          {latestCandle.volume !== undefined && (
            <>
              <span className="text-[var(--border)]">|</span>
              <div className="flex items-center gap-1">
                <span className="text-[var(--text-tertiary)]">Vol</span>
                <span className="text-[var(--text-secondary)]">{formatNumber(latestCandle.volume)}</span>
              </div>
            </>
          )}

          {isCrypto && marketStats && (
            <>
              <span className="text-[var(--border)]">|</span>
              <div className="flex items-center gap-1">
                <span className="text-[var(--text-tertiary)]">MCap</span>
                <span className="text-[var(--text-secondary)]">{formatNumber(marketStats.marketCap)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[var(--text-tertiary)]">24h Vol</span>
                <span className="text-[var(--text-secondary)]">{formatNumber(marketStats.volume24h)}</span>
              </div>
            </>
          )}

          {showDelayedBanner && (
            <span className="text-amber-400/70 text-[10px]" title="Yahoo Finance provides delayed/EOD data. Connect a broker for live data.">
              Delayed
            </span>
          )}
        </div>
      )}

      {/* Chart container */}
      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="w-full h-full" />

        {(status === 'connecting' || (candles.length < 5 && status !== 'error')) && (
          <LoadingOverlay message={status === 'connecting' ? 'Connecting...' : 'Loading...'} />
        )}

        {status === 'error' && candles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-[var(--red-down)]">Failed to load data for {symbol}</p>
          </div>
        )}
      </div>
    </div>
  )
}
