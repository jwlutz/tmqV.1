import { useEffect, useRef, useMemo, useState } from 'react'
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, AreaSeries, BarSeries, BaselineSeries, IChartApi, ISeriesApi, CrosshairMode, UTCTimestamp, PriceScaleMode } from 'lightweight-charts'
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

export type ChartType = 'candles' | 'line' | 'area' | 'bars' | 'baseline' | 'hlc' | 'hollow'
export type ScaleMode = 'normal' | 'log' | 'percent' | 'indexed'

export interface CandlestickWidgetProps {
  paneId: string
  symbol: string
  interval: string
  macroOverlays: MacroOverlay[]
  compareSymbol: string | null
  onCompareSymbolChange: (sym: string | null) => void
  onStatusChange?: (status: string) => void
  onIndicatorsReady?: (info: CandlestickIndicatorInfo) => void
  chartType?: ChartType
  scaleMode?: ScaleMode
  timeRange?: string | null
}

// Plot color variants for multi-plot indicators
const MULTI_PLOT_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4']

// Global registry for AI to toggle indicators on charts
declare global {
  interface Window {
    __chartIndicatorToggle?: Map<string, (indicatorId: string) => void>;
    __chartVolumeToggle?: Map<string, () => void>;
  }
}

export function CandlestickWidget({
  paneId,
  symbol,
  interval,
  macroOverlays = [],
  compareSymbol,
  onCompareSymbolChange,
  onStatusChange,
  onIndicatorsReady,
  chartType = 'candles',
  scaleMode = 'normal',
  timeRange: _timeRange,
}: CandlestickWidgetProps) {
  void _timeRange // Reserved for future time range presets
  const { candles, status, statusMessage, isCrypto, loadMoreHistory, isLoadingMore } = useMarketData(symbol, interval)
  const { stats: marketStats } = useMarketStats(symbol)
  const { providerCredentials } = useDataSettings()

  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mainSeriesRef = useRef<ISeriesApi<any> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const currentChartTypeRef = useRef<ChartType>(chartType)
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

  // Expose indicator toggle for AI control via global registry
  useEffect(() => {
    if (!window.__chartIndicatorToggle) {
      window.__chartIndicatorToggle = new Map()
    }
    if (!window.__chartVolumeToggle) {
      window.__chartVolumeToggle = new Map()
    }
    window.__chartIndicatorToggle.set(paneId, toggleIndicator)
    window.__chartVolumeToggle.set(paneId, toggleVolume)
    return () => {
      window.__chartIndicatorToggle?.delete(paneId)
      window.__chartVolumeToggle?.delete(paneId)
    }
  }, [paneId, toggleIndicator, toggleVolume])

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

    if (mainSeriesRef.current) {
      try { mainSeriesRef.current.setData([]) } catch { /* ignore */ }
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
        background: { color: '#131722' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(42, 46, 57, 0.8)' },
      leftPriceScale: {
        visible: false,
        borderColor: 'rgba(59, 130, 246, 0.3)',
      },
      timeScale: {
        borderColor: 'rgba(42, 46, 57, 0.8)',
        timeVisible: true,
        secondsVisible: false,
      },
    })

    // Create main series based on chart type
    const mainSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
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
    mainSeriesRef.current = mainSeries
    volumeSeriesRef.current = volumeSeries
    currentChartTypeRef.current = 'candles'
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

  // Track showVolume in a ref so candle update effect doesn't re-run on toggle
  const showVolumeRef = useRef(showVolume)
  showVolumeRef.current = showVolume

  // Apply scale mode changes
  useEffect(() => {
    if (chartDisposedRef.current || !chartRef.current) return
    const chart = chartRef.current

    const modeMap: Record<ScaleMode, PriceScaleMode> = {
      normal: PriceScaleMode.Normal,
      log: PriceScaleMode.Logarithmic,
      percent: PriceScaleMode.Percentage,
      indexed: PriceScaleMode.IndexedTo100,
    }

    try {
      chart.priceScale('right').applyOptions({
        mode: modeMap[scaleMode],
      })
    } catch (e) {
      console.warn('Failed to apply scale mode:', e)
    }
  }, [scaleMode])

  // Handle chart type changes by recreating the main series
  useEffect(() => {
    if (chartDisposedRef.current || !chartRef.current || candles.length === 0) return
    if (chartType === currentChartTypeRef.current) return

    const chart = chartRef.current

    // Remove old main series
    if (mainSeriesRef.current) {
      try { chart.removeSeries(mainSeriesRef.current) } catch { /* ignore */ }
      mainSeriesRef.current = null
    }

    // Create new series based on chart type
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let newSeries: ISeriesApi<any>

      if (chartType === 'candles' || chartType === 'hollow') {
        newSeries = chart.addSeries(CandlestickSeries, {
          upColor: chartType === 'hollow' ? 'transparent' : '#26a69a',
          downColor: chartType === 'hollow' ? 'transparent' : '#ef5350',
          borderUpColor: '#26a69a',
          borderDownColor: '#ef5350',
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350',
          lastValueVisible: false,
          priceLineVisible: false,
        })
        const chartCandles = candles.map(c => ({
          time: c.time as UTCTimestamp,
          open: c.open, high: c.high, low: c.low, close: c.close,
        }))
        newSeries.setData(chartCandles)
      } else if (chartType === 'bars' || chartType === 'hlc') {
        newSeries = chart.addSeries(BarSeries, {
          upColor: '#26a69a',
          downColor: '#ef5350',
          openVisible: chartType !== 'hlc',
          lastValueVisible: false,
          priceLineVisible: false,
        })
        const chartBars = candles.map(c => ({
          time: c.time as UTCTimestamp,
          open: c.open, high: c.high, low: c.low, close: c.close,
        }))
        newSeries.setData(chartBars)
      } else if (chartType === 'line') {
        newSeries = chart.addSeries(LineSeries, {
          color: '#2962ff',
          lineWidth: 2,
          lastValueVisible: false,
          priceLineVisible: false,
        })
        const lineData = candles.map(c => ({
          time: c.time as UTCTimestamp,
          value: c.close,
        }))
        newSeries.setData(lineData)
      } else if (chartType === 'area') {
        newSeries = chart.addSeries(AreaSeries, {
          lineColor: '#2962ff',
          topColor: 'rgba(41, 98, 255, 0.4)',
          bottomColor: 'rgba(41, 98, 255, 0.0)',
          lineWidth: 2,
          lastValueVisible: false,
          priceLineVisible: false,
        })
        const areaData = candles.map(c => ({
          time: c.time as UTCTimestamp,
          value: c.close,
        }))
        newSeries.setData(areaData)
      } else if (chartType === 'baseline') {
        const firstClose = candles[0]?.close ?? 0
        newSeries = chart.addSeries(BaselineSeries, {
          baseValue: { type: 'price', price: firstClose },
          topLineColor: '#26a69a',
          topFillColor1: 'rgba(38, 166, 154, 0.4)',
          topFillColor2: 'rgba(38, 166, 154, 0.0)',
          bottomLineColor: '#ef5350',
          bottomFillColor1: 'rgba(239, 83, 80, 0.0)',
          bottomFillColor2: 'rgba(239, 83, 80, 0.4)',
          lastValueVisible: false,
          priceLineVisible: false,
        })
        const baselineData = candles.map(c => ({
          time: c.time as UTCTimestamp,
          value: c.close,
        }))
        newSeries.setData(baselineData)
      } else {
        // Default to candlestick
        newSeries = chart.addSeries(CandlestickSeries, {
          upColor: '#26a69a',
          downColor: '#ef5350',
          borderUpColor: '#26a69a',
          borderDownColor: '#ef5350',
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350',
          lastValueVisible: false,
          priceLineVisible: false,
        })
        const chartCandles = candles.map(c => ({
          time: c.time as UTCTimestamp,
          open: c.open, high: c.high, low: c.low, close: c.close,
        }))
        newSeries.setData(chartCandles)
      }

      mainSeriesRef.current = newSeries
      currentChartTypeRef.current = chartType
    } catch (e) {
      console.warn('Failed to create new chart series:', e)
    }
  }, [chartType, candles])

  // Update chart when candles change
  useEffect(() => {
    if (chartDisposedRef.current) return
    if (!mainSeriesRef.current || !volumeSeriesRef.current || candles.length === 0) return

    const currentEarliestTime = candles[0].time
    const currentLatestTime = candles[candles.length - 1].time
    const isPrepending = earliestTimeRef.current !== null && currentEarliestTime < earliestTimeRef.current

    const isReset = isResettingRef.current ||
      (lastTimeRef.current !== null && currentLatestTime < lastTimeRef.current) ||
      Math.abs(candles.length - lastCandleCountRef.current) > 5

    // Check if current chart type uses OHLC or simple value format
    const currentType = currentChartTypeRef.current
    const isOHLCType = currentType === 'candles' || currentType === 'hollow' || currentType === 'bars' || currentType === 'hlc'

    try {
      if (isReset) {
        const chartVolume = candles.map(c => ({
          time: c.time as UTCTimestamp,
          value: c.volume ?? 0,
          color: c.close >= c.open ? '#26a69a80' : '#ef535080',
        }))

        if (isOHLCType) {
          const chartCandles = candles.map(c => ({
            time: c.time as UTCTimestamp,
            open: c.open, high: c.high, low: c.low, close: c.close,
          }))
          mainSeriesRef.current.setData(chartCandles)
        } else {
          const lineData = candles.map(c => ({
            time: c.time as UTCTimestamp,
            value: c.close,
          }))
          mainSeriesRef.current.setData(lineData)
        }

        if (showVolumeRef.current) {
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
          if (isOHLCType) {
            mainSeriesRef.current.update({
              time: lastCandle.time as UTCTimestamp,
              open: lastCandle.open, high: lastCandle.high,
              low: lastCandle.low, close: lastCandle.close,
            })
          } else {
            mainSeriesRef.current.update({
              time: lastCandle.time as UTCTimestamp,
              value: lastCandle.close,
            })
          }
          if (showVolumeRef.current) {
            volumeSeriesRef.current.update({
              time: lastCandle.time as UTCTimestamp,
              value: lastCandle.volume ?? 0,
              color: lastCandle.close >= lastCandle.open ? '#26a69a80' : '#ef535080',
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
  }, [candles])

  // Toggle volume visibility
  useEffect(() => {
    if (chartDisposedRef.current || !volumeSeriesRef.current) return
    if (!showVolume) {
      try { volumeSeriesRef.current.setData([]) } catch { /* ignore */ }
    } else if (candles.length > 0) {
      const chartVolume = candles.map(c => ({
        time: c.time as UTCTimestamp,
        value: c.volume ?? 0,
        color: c.close >= c.open ? '#26a69a80' : '#ef535080',
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

    // Remove series that are no longer active
    const idsToRemove: string[] = []
    indicatorSeriesRef.current.forEach((_series, seriesKey) => {
      if (!activeSeriesKeys.has(seriesKey)) {
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

        {/* Loading states */}
        {(status === 'loading' || status === 'connecting' || (candles.length < 5 && status !== 'error' && status !== 'no_data')) && (
          <LoadingOverlay message={statusMessage || 'Loading...'} />
        )}

        {/* No data state */}
        {status === 'no_data' && candles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-darkest)]/80">
            <div className="text-center">
              <p className="text-sm text-[var(--text-secondary)]">{statusMessage || `No data available for ${symbol}`}</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">Try a different symbol or date range</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {status === 'error' && candles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-darkest)]/80">
            <div className="text-center">
              <p className="text-sm text-[var(--red-down)]">{statusMessage || `Failed to load ${symbol}`}</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">Check the symbol and try again</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
