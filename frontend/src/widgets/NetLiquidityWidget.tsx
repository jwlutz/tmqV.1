import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, AreaSeries, LineSeries, IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts'
import { fetchMacroSeries, fetchOHLCV } from '../api/client'
import { LoadingSkeleton, ErrorState, FREDNotConfigured } from './shared'
import type { WidgetDefinition } from './types'

interface Props {
  definition: WidgetDefinition
  width: number
  height: number
}

interface ChartPoint {
  time: UTCTimestamp
  value: number
}

function computeCorrelation(xs: number[], ys: number[]): number | null {
  const n = xs.length
  if (n < 10) return null

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0
  for (let i = 0; i < n; i++) {
    sumX += xs[i]
    sumY += ys[i]
    sumXY += xs[i] * ys[i]
    sumX2 += xs[i] * xs[i]
    sumY2 += ys[i] * ys[i]
  }

  const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
  if (denom === 0) return null
  return (n * sumXY - sumX * sumY) / denom
}

export function NetLiquidityWidget({ }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const chartDisposedRef = useRef(false)
  const nlSeriesRef = useRef<ISeriesApi<'Area'> | null>(null)
  const spySeriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [correlation, setCorrelation] = useState<number | null>(null)
  const [latestNL, setLatestNL] = useState<number | null>(null)
  const [latestSPY, setLatestSPY] = useState<number | null>(null)
  const [hasData, setHasData] = useState(false)

  // Create chart on mount — container is always in DOM
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
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
      leftPriceScale: { visible: true, borderColor: 'rgba(255,255,255,0.06)' },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        timeVisible: true,
        secondsVisible: false,
      },
    })

    chartRef.current = chart
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

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const end = new Date()
      const start = new Date()
      start.setFullYear(start.getFullYear() - 2)

      const startStr = start.toISOString().split('T')[0]
      const endStr = end.toISOString().split('T')[0]

      // Fetch each FRED series independently to avoid fetch_multiple alignment issues
      const [walclRes, tgaRes, rrpRes, spyRes] = await Promise.all([
        fetchMacroSeries('WALCL', startStr, endStr),
        fetchMacroSeries('WTREGEN', startStr, endStr),
        fetchMacroSeries('RRPONTSYD', startStr, endStr),
        fetchOHLCV('SPY', '1d', startStr, endStr),
      ])

      // Build maps by date for each series
      const walclMap = new Map<string, number>()
      for (const d of walclRes.data) {
        if (d.value != null && !isNaN(d.value)) walclMap.set(d.date, d.value)
      }
      const tgaMap = new Map<string, number>()
      for (const d of tgaRes.data) {
        if (d.value != null && !isNaN(d.value)) tgaMap.set(d.date, d.value)
      }
      const rrpMap = new Map<string, number>()
      for (const d of rrpRes.data) {
        if (d.value != null && !isNaN(d.value)) rrpMap.set(d.date, d.value)
      }

      // Collect all macro dates and sort them
      const allMacroDates = [...new Set([
        ...walclMap.keys(), ...tgaMap.keys(), ...rrpMap.keys()
      ])].sort()

      // Forward-fill each series independently across all macro dates
      let lastWalcl: number | null = null
      let lastTga: number | null = null
      let lastRrp: number | null = null
      const nlByDate = new Map<string, number>()

      for (const date of allMacroDates) {
        if (walclMap.has(date)) lastWalcl = walclMap.get(date)!
        if (tgaMap.has(date)) lastTga = tgaMap.get(date)!
        if (rrpMap.has(date)) lastRrp = rrpMap.get(date)!

        if (lastWalcl !== null && lastTga !== null && lastRrp !== null) {
          nlByDate.set(date, lastWalcl - lastTga - lastRrp)
        }
      }

      if (nlByDate.size === 0) {
        setError('No net liquidity data available — FRED series may be empty')
        setLoading(false)
        return
      }

      // Build SPY data
      interface OHLCVRow { date: string; close: number }
      const spyRows = (spyRes.data as OHLCVRow[])
        .filter(r => r.close != null)
        .sort((a, b) => a.date.localeCompare(b.date))

      // Forward-fill net liquidity to daily SPY dates using sorted macro dates
      const sortedNLDates = [...nlByDate.keys()].sort()
      const nlPoints: ChartPoint[] = []
      const spyPoints: ChartPoint[] = []
      let nlIdx = 0
      let currentNL: number | null = null

      for (const spyRow of spyRows) {
        const date = spyRow.date

        // Advance nlIdx to the latest macro date <= this SPY date
        while (nlIdx < sortedNLDates.length && sortedNLDates[nlIdx] <= date) {
          currentNL = nlByDate.get(sortedNLDates[nlIdx])!
          nlIdx++
        }

        if (currentNL !== null) {
          const ts = Math.floor(new Date(date).getTime() / 1000) as UTCTimestamp
          nlPoints.push({ time: ts, value: currentNL })
          spyPoints.push({ time: ts, value: spyRow.close })
        }
      }

      if (nlPoints.length === 0) {
        setError('No overlapping data between net liquidity and SPY')
        setLoading(false)
        return
      }

      // Compute rolling 90-day correlation
      const windowSize = 90
      if (nlPoints.length >= windowSize) {
        const recentNL = nlPoints.slice(-windowSize).map(p => p.value)
        const recentSPY = spyPoints.slice(-windowSize).map(p => p.value)
        setCorrelation(computeCorrelation(recentNL, recentSPY))
      } else if (nlPoints.length >= 10) {
        setCorrelation(computeCorrelation(
          nlPoints.map(p => p.value),
          spyPoints.map(p => p.value),
        ))
      }

      if (nlPoints.length > 0) {
        setLatestNL(nlPoints[nlPoints.length - 1].value)
      }
      if (spyPoints.length > 0) {
        setLatestSPY(spyPoints[spyPoints.length - 1].value)
      }

      // Render series on chart
      if (chartRef.current && !chartDisposedRef.current) {
        const chart = chartRef.current

        if (nlSeriesRef.current) {
          try { chart.removeSeries(nlSeriesRef.current) } catch { /* ignore */ }
          nlSeriesRef.current = null
        }
        if (spySeriesRef.current) {
          try { chart.removeSeries(spySeriesRef.current) } catch { /* ignore */ }
          spySeriesRef.current = null
        }

        const nlSeries = chart.addSeries(AreaSeries, {
          topColor: 'rgba(41, 98, 255, 0.3)',
          bottomColor: 'rgba(41, 98, 255, 0.0)',
          lineColor: '#2962FF',
          lineWidth: 2,
          priceScaleId: 'left',
          priceFormat: {
            type: 'custom',
            formatter: (price: number) => `$${(price / 1e6).toFixed(1)}T`,
          },
          lastValueVisible: true,
          priceLineVisible: false,
        })

        const spySeries = chart.addSeries(LineSeries, {
          color: '#FF6D00',
          lineWidth: 2,
          priceScaleId: 'right',
          lastValueVisible: true,
          priceLineVisible: false,
        })

        nlSeries.setData(nlPoints)
        spySeries.setData(spyPoints)

        nlSeriesRef.current = nlSeries
        spySeriesRef.current = spySeries

        chart.timeScale().fitContent()
      }

      setHasData(true)
      setLoading(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load net liquidity data'
      if (message.toLowerCase().includes('not configured') || message.toLowerCase().includes('configure')) {
        setError('fred_not_configured')
      } else {
        setError(message)
      }
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (error === 'fred_not_configured') return <FREDNotConfigured />

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0">
          <LoadingSkeleton label="Loading net liquidity..." />
        </div>
      )}

      {/* Error overlay */}
      {error && error !== 'fred_not_configured' && (
        <div className="absolute inset-0">
          <ErrorState message={error} onRetry={load} />
        </div>
      )}

      {/* Legend overlay — only when data is loaded */}
      {hasData && !loading && !error && (
        <div className="absolute top-2 left-2 bg-[#0b0f19]/85 backdrop-blur-sm rounded-lg px-3 py-2 pointer-events-none border border-white/5">
          <div className="text-xs font-semibold text-[var(--text-primary)] mb-1.5">
            Net Liquidity vs S&P 500
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-0.5 rounded-full bg-[#2962FF]" />
              <span className="text-[10px] text-[var(--text-secondary)]">
                Net Liquidity
                {latestNL !== null && (
                  <span className="text-[var(--text-primary)] ml-1">
                    ${(latestNL / 1e6).toFixed(2)}T
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-0.5 rounded-full bg-[#FF6D00]" />
              <span className="text-[10px] text-[var(--text-secondary)]">
                SPY
                {latestSPY !== null && (
                  <span className="text-[var(--text-primary)] ml-1">
                    ${latestSPY.toFixed(2)}
                  </span>
                )}
              </span>
            </div>
            {correlation !== null && (
              <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                Correlation (90d):{' '}
                <span className={
                  correlation >= 0.7 ? 'text-[var(--green-up)]' :
                  correlation <= -0.7 ? 'text-[var(--red-down)]' :
                  'text-[var(--text-secondary)]'
                }>
                  {correlation.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
