import { useEffect, useRef, useMemo, useState } from 'react'
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, IChartApi, ISeriesApi, CrosshairMode, UTCTimestamp } from 'lightweight-charts'
import { useMarketData } from '../../hooks'
import { useIndicators, IndicatorData } from '../../hooks/useIndicators'
import { useMarketStats } from '../../hooks/useMarketStats'
import { useDataSettings } from '../../context'
import { LoadingOverlay } from '../ui'
import { IndicatorsDropdown } from './IndicatorsDropdown'
import { PaneIntervalSelector } from './PaneIntervalSelector'
import { TickerDropdown } from './TickerDropdown'
import { LayoutSelector } from './LayoutSelector'
import { CompareDropdown } from './CompareDropdown'
import { formatPrice, formatNumber } from '../../hooks/useMarketStats'
import { fetchOHLCV } from '../../api/client'
import type { ChartLayout } from '../../context'

interface ChartPaneProps {
  paneId: string;
  symbol: string;
  interval: string;
  isActive: boolean;
  onActivate: () => void;
  onSymbolChange: (symbol: string) => void;
  onIntervalChange: (interval: string) => void;
  showLayoutSelector?: boolean;
  layoutValue?: ChartLayout;
  onLayoutChange?: (layout: ChartLayout) => void;
}

export function ChartPane({ symbol, interval, isActive, onActivate, onSymbolChange, onIntervalChange, showLayoutSelector, layoutValue, onLayoutChange }: ChartPaneProps) {
  const { candles, status, isCrypto, loadMoreHistory, isLoadingMore } = useMarketData(symbol, interval)
  const { stats: marketStats } = useMarketStats(symbol)
  const { providerCredentials } = useDataSettings()
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map())
  const compareSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const lastCandleCountRef = useRef(0)
  const earliestTimeRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)
  const isResettingRef = useRef(false)
  const chartDisposedRef = useRef(false)

  // Comparison symbol state
  const [compareSymbol, setCompareSymbol] = useState<string | null>(null)
  const [compareData, setCompareData] = useState<Array<{ time: UTCTimestamp; value: number }>>([])
  const [, setCompareLoading] = useState(false)

  // Show delayed data banner for equities without a live provider
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
  } = useIndicators({
    symbol,
    interval,
    startDate: dateRange.start,
    endDate: dateRange.end,
  })

  // Get latest candle for stats display
  const latestCandle = candles.length > 0 ? candles[candles.length - 1] : null

  // Compute change from open using latest candle
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
        const apiSymbol = compareSymbol!.replace('-', '/')
        const res = await fetchOHLCV(apiSymbol, interval, dateRange.start!, dateRange.end!)
        if (cancelled) return

        if (res.data?.length > 0 && candles.length > 0) {
          // Build a map of compare dates (YYYY-MM-DD) to close values
          // This handles timezone mismatches between data sources
          const compareDateMap = new Map<string, number>()
          res.data.forEach((d: { date: string; close: number }) => {
            compareDateMap.set(d.date, d.close)
          })

          const aligned: Array<{ time: UTCTimestamp; value: number }> = []
          let lastValue: number | null = null

          for (const candle of candles) {
            // Convert main candle timestamp to date string for matching
            const mainDateStr = new Date(candle.time * 1000).toISOString().split('T')[0]

            if (compareDateMap.has(mainDateStr)) {
              lastValue = compareDateMap.get(mainDateStr)!
              aligned.push({ time: candle.time as UTCTimestamp, value: lastValue })
            } else if (lastValue !== null) {
              // Carry forward last known value for gaps (weekends, holidays)
              aligned.push({ time: candle.time as UTCTimestamp, value: lastValue })
            }
          }

          setCompareData(aligned)
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
  }, [compareSymbol, interval, dateRange.start, dateRange.end, symbol, candles])

  // Track the current compare symbol for the series
  const compareSymbolForSeriesRef = useRef<string | null>(null)

  // Render comparison series
  useEffect(() => {
    if (chartDisposedRef.current || !chartRef.current) return
    const chart = chartRef.current

    // Remove series if no compare symbol
    if (!compareSymbol) {
      if (compareSeriesRef.current) {
        try { chart.removeSeries(compareSeriesRef.current) } catch { /* ignore */ }
        compareSeriesRef.current = null
        compareSymbolForSeriesRef.current = null
        // Hide left scale
        chart.priceScale('left').applyOptions({ visible: false })
      }
      return
    }

    // If symbol changed, remove old series first
    if (compareSeriesRef.current && compareSymbolForSeriesRef.current !== compareSymbol) {
      try { chart.removeSeries(compareSeriesRef.current) } catch { /* ignore */ }
      compareSeriesRef.current = null
    }

    // Wait for data before creating series
    if (compareData.length === 0) return

    // Create series if needed
    if (!compareSeriesRef.current) {
      try {
        compareSeriesRef.current = chart.addSeries(LineSeries, {
          color: '#fbbf24',
          lineWidth: 2,
          priceScaleId: 'left',
          lastValueVisible: true,
          priceLineVisible: false,
          title: compareSymbol,
        })
        chart.priceScale('left').applyOptions({
          visible: true,
          borderColor: 'rgba(255, 191, 36, 0.3)',
        })
        compareSymbolForSeriesRef.current = compareSymbol
      } catch (e) {
        console.warn('Failed to create comparison series:', e)
        return
      }
    }

    try {
      compareSeriesRef.current.setData(compareData)
    } catch (e) {
      console.warn('Failed to set comparison data:', e)
    }
  }, [compareSymbol, compareData])

  // Clear comparison when main symbol changes
  useEffect(() => {
    // Skip initial mount
    if (!compareSeriesRef.current && !compareSymbol) return

    if (compareSeriesRef.current && chartRef.current && !chartDisposedRef.current) {
      try { chartRef.current.removeSeries(compareSeriesRef.current) } catch { /* ignore */ }
      compareSeriesRef.current = null
      compareSymbolForSeriesRef.current = null
    }
    setCompareSymbol(null)
    setCompareData([])
  }, [symbol])

  return (
    <div
      className={`flex flex-col w-full h-full rounded-lg overflow-hidden border transition-colors ${
        isActive
          ? 'border-[var(--green-up)]/50'
          : 'border-[var(--border)] hover:border-[rgba(255,255,255,0.12)]'
      }`}
      onClick={onActivate}
    >
      {/* Pane header */}
      <div className="flex items-center justify-between gap-2 px-2 py-1 bg-[var(--bg-darker)] border-b border-[var(--border)] min-h-[28px]">
        <div className="flex items-center gap-2 min-w-0">
          {/* Symbol dropdown with search */}
          <div onClick={e => e.stopPropagation()}>
            <TickerDropdown value={symbol} onChange={onSymbolChange} />
          </div>

          {/* Per-pane interval selector */}
          <PaneIntervalSelector value={interval} onChange={onIntervalChange} />

          {/* Active indicator chips */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-0.5">
              {selectedIds.slice(0, 3).map(id => {
                const config = availableIndicators.find(i => i.id === id)
                if (!config) return null
                return (
                  <button
                    key={id}
                    onClick={(e) => { e.stopPropagation(); toggleIndicator(id) }}
                    className="flex items-center gap-0.5 px-1 py-0 rounded text-[10px] font-mono bg-white/5 hover:bg-white/10 transition-colors"
                    style={{ color: config.color }}
                    title={`Remove ${config.label}`}
                  >
                    {config.label}
                    <span className="text-[var(--text-tertiary)]">&times;</span>
                  </button>
                )
              })}
              {selectedIds.length > 3 && (
                <span className="text-[10px] text-[var(--text-tertiary)]">+{selectedIds.length - 3}</span>
              )}
            </div>
          )}
          <IndicatorsDropdown
            indicators={availableIndicators}
            selectedIds={selectedIds}
            onToggle={toggleIndicator}
            disabled={status !== 'connected' && status !== 'error'}
          />
          <div onClick={e => e.stopPropagation()}>
            <CompareDropdown
              value={compareSymbol}
              onChange={setCompareSymbol}
              disabled={status !== 'connected' && status !== 'error'}
              currentSymbol={symbol}
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Layout selector (only in single-pane mode) */}
          {showLayoutSelector && layoutValue && onLayoutChange && (
            <div onClick={e => e.stopPropagation()}>
              <LayoutSelector value={layoutValue} onChange={onLayoutChange} />
            </div>
          )}
          {/* Connection dot */}
          <span className={`w-1.5 h-1.5 rounded-full ${
            status === 'connected' ? 'bg-[var(--green-up)]' :
            status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
            'bg-[var(--red-down)]'
          }`} />
        </div>
      </div>

      {/* Stats bar */}
      {latestCandle && (
        <div className="flex items-center gap-3 px-2 py-0.5 bg-[var(--bg-dark)] border-b border-[var(--border)] text-[11px] font-mono flex-wrap">
          {/* Price + Change */}
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

          {/* OHLCV */}
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

          {/* Crypto: market cap + 24h volume from CoinGecko */}
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

          {/* Equity: delayed data badge */}
          {showDelayedBanner && (
            <span className="text-amber-400/70 text-[10px]" title="Yahoo Finance provides delayed/EOD data. Connect a broker for live data.">
              Delayed
            </span>
          )}
        </div>
      )}

      {/* Chart container */}
      <div className="relative flex-1">
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
