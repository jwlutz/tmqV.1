import { useState, useEffect, useRef, useCallback } from 'react'
import { createChart, LineSeries, IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts'
import { fetchMacroSeries } from '../api/client'
import { LoadingSkeleton, ErrorState, FREDNotConfigured } from './shared'
import type { WidgetDefinition } from './types'

interface Props {
  definition: WidgetDefinition
  width: number
  height: number
}

function getZone(value: number): { label: string; color: string } {
  if (value < 400) return { label: 'Normal', color: '#00C853' }
  if (value < 600) return { label: 'Elevated', color: '#FFD700' }
  if (value < 800) return { label: 'Stress', color: '#FF6D00' }
  return { label: 'Crisis', color: '#FF1744' }
}

export function CreditSpreadsWidget({ }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const chartDisposedRef = useRef(false)
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [latestValue, setLatestValue] = useState<number | null>(null)
  const [chartData, setChartData] = useState<Array<{ time: UTCTimestamp; value: number }>>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const end = new Date().toISOString().slice(0, 10)
    const startDate = new Date()
    startDate.setFullYear(startDate.getFullYear() - 5)
    const start = startDate.toISOString().slice(0, 10)

    try {
      const res = await fetchMacroSeries('BAMLH0A0HYM2', start, end)
      const points = res.data
        .filter((d) => d.value != null && !isNaN(d.value))
        .map((d) => ({
          time: (new Date(d.date).getTime() / 1000) as UTCTimestamp,
          value: d.value,
        }))
        .sort((a, b) => (a.time as number) - (b.time as number))

      setChartData(points)
      if (points.length > 0) {
        setLatestValue(points[points.length - 1].value)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch credit spreads'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch data on mount — always try, error handler detects "not configured"
  useEffect(() => {
    load()
  }, [load])

  // Chart init
  useEffect(() => {
    if (!containerRef.current || loading || error || chartData.length === 0) return

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: { background: { color: '#0b0f19' }, textColor: '#e8ecf4' },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.06)' },
        horzLines: { color: 'rgba(255,255,255,0.06)' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.06)', timeVisible: true, secondsVisible: false },
    })
    chartRef.current = chart
    chartDisposedRef.current = false

    const series = chart.addSeries(LineSeries, {
      color: '#2962FF',
      lineWidth: 2,
      priceFormat: {
        type: 'custom',
        formatter: (price: number) => price.toFixed(0) + ' bps',
      },
    })
    seriesRef.current = series

    series.setData(chartData)

    // Stress zone price lines
    series.createPriceLine({ price: 400, color: '#FFD700', lineWidth: 1, lineStyle: 2, title: '400bp - Elevated' })
    series.createPriceLine({ price: 600, color: '#FF6D00', lineWidth: 1, lineStyle: 2, title: '600bp - Stress' })
    series.createPriceLine({ price: 800, color: '#FF1744', lineWidth: 1, lineStyle: 2, title: '800bp - Crisis' })

    chart.timeScale().fitContent()

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
  }, [chartData, loading, error])

  // Early returns for non-chart states
  if (loading) return <LoadingSkeleton label="Loading credit spreads..." />
  if (error) {
    if (error.toLowerCase().includes('not configured') || error.toLowerCase().includes('configure')) return <FREDNotConfigured />
    return <ErrorState message={error} onRetry={load} />
  }

  const zone = latestValue !== null ? getZone(latestValue) : null

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" />
      {latestValue !== null && zone && (
        <div
          className="absolute top-2 left-2 flex flex-col gap-0.5 px-2.5 py-1.5 rounded-lg pointer-events-none"
          style={{ backgroundColor: 'rgba(11, 15, 25, 0.85)' }}
        >
          <span className="text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
            HY Credit Spreads (OAS)
          </span>
          <span
            className="text-lg font-bold font-mono leading-tight"
            style={{ color: zone.color }}
          >
            {latestValue.toFixed(0)} bps
          </span>
          <span
            className="text-xs font-semibold"
            style={{ color: zone.color }}
          >
            {zone.label}
          </span>
        </div>
      )}
    </div>
  )
}
