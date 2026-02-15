import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, IChartApi, ISeriesApi, CrosshairMode, UTCTimestamp } from 'lightweight-charts'
import { useMarketData } from '../../hooks'
import { useIndicators, IndicatorData } from '../../hooks/useIndicators'
import { useMarketStats } from '../../hooks/useMarketStats'
import { LoadingOverlay } from '../ui'
import { IndicatorsDropdown } from './IndicatorsDropdown'
import { formatPrice } from '../../hooks/useMarketStats'

interface ChartPaneProps {
  paneId: string;
  symbol: string;
  interval: string;
  isActive: boolean;
  onActivate: () => void;
  onSymbolChange: (symbol: string) => void;
}

export function ChartPane({ symbol, interval, isActive, onActivate, onSymbolChange }: ChartPaneProps) {
  const { candles, status, loadMoreHistory, isLoadingMore } = useMarketData(symbol, interval)
  const { stats: marketStats } = useMarketStats(symbol)
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map())
  const lastCandleCountRef = useRef(0)
  const earliestTimeRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)
  const isResettingRef = useRef(false)
  const chartDisposedRef = useRef(false)
  const [editingSymbol, setEditingSymbol] = useState(false)
  const [symbolInput, setSymbolInput] = useState(symbol)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync symbolInput when prop changes
  useEffect(() => {
    setSymbolInput(symbol)
  }, [symbol])

  // Focus input when editing starts
  useEffect(() => {
    if (editingSymbol) inputRef.current?.focus()
  }, [editingSymbol])

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
  } = useIndicators({
    symbol,
    interval,
    startDate: dateRange.start,
    endDate: dateRange.end,
  })

  // Get latest candle for price display
  const latestCandle = candles.length > 0 ? candles[candles.length - 1] : null
  const currentPrice = latestCandle?.close ?? marketStats?.price

  const handleSymbolSubmit = useCallback(() => {
    const trimmed = symbolInput.trim().toUpperCase()
    if (trimmed && trimmed !== symbol) {
      onSymbolChange(trimmed)
    }
    setEditingSymbol(false)
  }, [symbolInput, symbol, onSymbolChange])

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
        volumeSeriesRef.current.setData(chartVolume)

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
      console.warn('Chart update failed, will reset:', e)
      isResettingRef.current = true
    }
  }, [candles])

  // Update indicator series
  useEffect(() => {
    if (chartDisposedRef.current || !chartRef.current) return
    const chart = chartRef.current

    // Remove deselected
    const idsToRemove: string[] = []
    indicatorSeriesRef.current.forEach((_series, id) => {
      const baseId = id.split('-bb_')[0]
      if (!selectedIds.includes(baseId) && !selectedIds.includes(id)) {
        idsToRemove.push(id)
      }
    })
    for (const id of idsToRemove) {
      const series = indicatorSeriesRef.current.get(id)
      if (series && chart && !chartDisposedRef.current) {
        try { chart.removeSeries(series) } catch { /* ignore */ }
      }
      indicatorSeriesRef.current.delete(id)
    }

    // Add/update active
    activeIndicators.forEach((indicator: IndicatorData) => {
      if (chartDisposedRef.current || !chart) return
      const { config, points } = indicator
      if (points.length === 0) return

      if (config.name === 'bbands') {
        updateBollingerSeries(indicator)
        return
      }

      let series = indicatorSeriesRef.current.get(config.id)
      if (!series) {
        try {
          series = chart.addSeries(LineSeries, {
            color: config.color,
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
          if (config.levels) {
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
          indicatorSeriesRef.current.set(config.id, series)
        } catch (e) {
          console.warn(`Failed to create indicator series for ${config.id}:`, e)
          return
        }
      }

      const valueKey = getValueKey(config.name)
      const seriesData = points
        .filter(p => p[valueKey] !== undefined && p[valueKey] !== null)
        .map(p => ({
          time: Math.floor(new Date(p.date).getTime() / 1000) as UTCTimestamp,
          value: Number(p[valueKey]),
        }))
        .sort((a, b) => a.time - b.time)
        .filter((item, idx, arr) => idx === arr.length - 1 || item.time !== arr[idx + 1].time)

      if (seriesData.length > 0) {
        try { series.setData(seriesData) } catch (e) {
          console.warn(`Failed to set indicator data for ${config.id}:`, e)
        }
      }
    })
  }, [activeIndicators, selectedIds])

  function getValueKey(indicatorName: string): string {
    switch (indicatorName) {
      case 'ema': return 'ema'
      case 'sma': return 'sma'
      case 'rsi': return 'rsi'
      case 'macd': return 'macd'
      case 'stoch': return 'stoch_k'
      case 'atr': return 'atr'
      case 'adx': return 'adx'
      case 'vwap': return 'vwap'
      case 'obv': return 'obv'
      default: return 'value'
    }
  }

  function updateBollingerSeries(indicator: IndicatorData) {
    if (chartDisposedRef.current || !chartRef.current) return
    const { config, points } = indicator
    if (points.length === 0) return

    const chart = chartRef.current
    const bandKeys = ['bb_upper', 'bb_mid', 'bb_lower'] as const
    const bandColors = [config.color, config.color + '80', config.color]

    bandKeys.forEach((key, idx) => {
      if (chartDisposedRef.current) return
      const seriesId = `${config.id}-${key}`
      let series = indicatorSeriesRef.current.get(seriesId)

      if (!series) {
        try {
          series = chart.addSeries(LineSeries, {
            color: bandColors[idx],
            lineWidth: 1,
            lineStyle: idx === 1 ? 2 : 0,
            priceScaleId: 'right',
            lastValueVisible: false,
            priceLineVisible: false,
          })
          indicatorSeriesRef.current.set(seriesId, series)
        } catch (e) {
          console.warn(`Failed to create Bollinger band series:`, e)
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
        try { series.setData(seriesData) } catch (e) {
          console.warn(`Failed to set Bollinger band data:`, e)
        }
      }
    })
  }

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

  return (
    <div
      className={`flex flex-col w-full h-full rounded-lg overflow-hidden border transition-colors ${
        isActive
          ? 'border-[var(--green-up)]/50'
          : 'border-[var(--border)] hover:border-[var(--border-hover,rgba(255,255,255,0.12))]'
      }`}
      onClick={onActivate}
    >
      {/* Pane header */}
      <div className="flex items-center justify-between gap-2 px-2 py-1 bg-[var(--bg-darker)] border-b border-[var(--border)] min-h-[28px]">
        <div className="flex items-center gap-2 min-w-0">
          {/* Symbol input */}
          {editingSymbol ? (
            <input
              ref={inputRef}
              value={symbolInput}
              onChange={e => setSymbolInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSymbolSubmit()
                if (e.key === 'Escape') { setEditingSymbol(false); setSymbolInput(symbol) }
              }}
              onBlur={handleSymbolSubmit}
              className="w-24 px-1 py-0.5 bg-[var(--bg-medium)] border border-[var(--border)] rounded text-xs font-mono text-[var(--text-primary)] outline-none focus:border-[var(--text-secondary)]"
            />
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setEditingSymbol(true) }}
              className="text-xs font-mono font-semibold text-[var(--text-primary)] hover:text-[var(--green-up)] transition-colors"
            >
              {symbol}
            </button>
          )}

          {/* Price */}
          {currentPrice !== undefined && (
            <span className="text-xs font-mono text-[var(--text-secondary)]">
              {formatPrice(currentPrice)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <IndicatorsDropdown
            indicators={availableIndicators}
            selectedIds={selectedIds}
            onToggle={toggleIndicator}
            disabled={status !== 'connected'}
          />
          {/* Connection dot */}
          <span className={`w-1.5 h-1.5 rounded-full ${
            status === 'connected' ? 'bg-[var(--green-up)]' :
            status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
            'bg-[var(--red-down)]'
          }`} />
        </div>
      </div>

      {/* Chart container */}
      <div className="relative flex-1">
        <div ref={containerRef} className="w-full h-full" />

        {(status === 'connecting' || candles.length < 5) && (
          <LoadingOverlay message={status === 'connecting' ? 'Connecting...' : 'Loading...'} />
        )}
      </div>
    </div>
  )
}
