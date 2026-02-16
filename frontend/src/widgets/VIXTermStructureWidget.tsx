import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, ReferenceLine,
} from 'recharts'
import { fetchMacroSeries } from '../api/client'
import { LoadingSkeleton, ErrorState, FREDNotConfigured } from './shared'
import type { WidgetDefinition } from './types'

interface Props {
  definition: WidgetDefinition
  width: number
  height: number
}

interface VIXDataPoint {
  date: string
  vix: number
}

const REGIMES = [
  { min: 0, max: 15, label: 'Low Vol / Complacent', color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
  { min: 15, max: 20, label: 'Normal', color: '#8a8f98', bg: 'transparent' },
  { min: 20, max: 25, label: 'Elevated', color: '#eab308', bg: 'rgba(234,179,8,0.06)' },
  { min: 25, max: 30, label: 'Fear', color: '#f97316', bg: 'rgba(249,115,22,0.06)' },
  { min: 30, max: 100, label: 'Crisis / Capitulation', color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
]

function getRegime(vix: number) {
  return REGIMES.find(r => vix >= r.min && vix < r.max) || REGIMES[REGIMES.length - 1]
}

function computePercentile(current: number, values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  let count = 0
  for (const v of sorted) {
    if (v <= current) count++
  }
  return Math.round((count / sorted.length) * 100)
}

function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const vix = payload[0]?.value
  const regime = vix != null ? getRegime(vix) : null
  return (
    <div className="bg-[#1a1f2e] border border-[var(--border)] rounded px-2.5 py-1.5 shadow-lg">
      <div className="text-[11px] text-[var(--text-secondary)] mb-1">{label}</div>
      <div className="flex items-center gap-1.5 text-[11px]">
        <span className="text-[var(--text-primary)] font-medium">VIX: {vix?.toFixed(2)}</span>
        {regime && (
          <span style={{ color: regime.color }} className="text-[10px]">{regime.label}</span>
        )}
      </div>
    </div>
  )
}

export function VIXTermStructureWidget({}: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<VIXDataPoint[]>([])
  const [currentVix, setCurrentVix] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const end = new Date()
      const start = new Date()
      start.setFullYear(start.getFullYear() - 2)

      const res = await fetchMacroSeries(
        'VIXCLS',
        start.toISOString().split('T')[0],
        end.toISOString().split('T')[0],
      )

      const points: VIXDataPoint[] = res.data
        .filter(d => d.value != null && !isNaN(d.value))
        .map(d => ({ date: d.date, vix: d.value }))
        .sort((a, b) => a.date.localeCompare(b.date))

      setData(points)
      if (points.length > 0) {
        setCurrentVix(points[points.length - 1].vix)
      }
      setLoading(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load VIX data'
      if (msg.toLowerCase().includes('not configured') || msg.toLowerCase().includes('configure')) {
        setError('fred_not_configured')
      } else {
        setError(msg)
      }
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const allValues = useMemo(() => data.map(d => d.vix), [data])
  const percentile = useMemo(() => {
    if (currentVix == null) return null
    return computePercentile(currentVix, allValues)
  }, [currentVix, allValues])

  const p50 = useMemo(() => allValues.length > 0 ? quantile(allValues, 0.5) : null, [allValues])
  const p90 = useMemo(() => allValues.length > 0 ? quantile(allValues, 0.9) : null, [allValues])

  const regime = currentVix != null ? getRegime(currentVix) : null

  // Compute y-axis domain
  const yMax = useMemo(() => {
    if (allValues.length === 0) return 50
    return Math.ceil(Math.max(...allValues) / 5) * 5 + 5
  }, [allValues])

  if (error === 'fred_not_configured') return <FREDNotConfigured />

  return (
    <div className="w-full h-full flex flex-col bg-[var(--bg-dark)]">
      {loading && <LoadingSkeleton label="Loading VIX data..." />}
      {error && error !== 'fred_not_configured' && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && data.length > 0 && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-1.5 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                VIX Volatility Index
              </span>
              {currentVix != null && regime && (
                <>
                  <span className="text-sm font-bold" style={{ color: regime.color }}>
                    {currentVix.toFixed(2)}
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium border"
                    style={{
                      color: regime.color,
                      backgroundColor: regime.bg,
                      borderColor: `${regime.color}40`,
                    }}
                  >
                    {regime.label}
                  </span>
                </>
              )}
            </div>
            {percentile !== null && (
              <span className="text-[10px] text-[var(--text-tertiary)]">
                {percentile}th percentile (2Y)
              </span>
            )}
          </div>

          {/* Chart */}
          <div className="flex-1 min-h-0 px-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />

                {/* Regime background bands */}
                <ReferenceArea y1={0} y2={15} fill="rgba(34,197,94,0.06)" fillOpacity={1} />
                <ReferenceArea y1={20} y2={25} fill="rgba(234,179,8,0.04)" fillOpacity={1} />
                <ReferenceArea y1={25} y2={30} fill="rgba(249,115,22,0.04)" fillOpacity={1} />
                <ReferenceArea y1={30} y2={yMax} fill="rgba(239,68,68,0.06)" fillOpacity={1} />

                {/* Percentile reference lines */}
                {p50 !== null && (
                  <ReferenceLine
                    y={p50}
                    stroke="#8a8f98"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                    label={{ value: 'P50', position: 'right', fill: '#8a8f98', fontSize: 10 }}
                  />
                )}
                {p90 !== null && (
                  <ReferenceLine
                    y={p90}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                    label={{ value: 'P90', position: 'right', fill: '#ef4444', fontSize: 10 }}
                  />
                )}

                <XAxis
                  dataKey="date"
                  tick={{ fill: '#8a8f98', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickFormatter={(v: string) => {
                    const parts = v.split('-')
                    return parts.length >= 2 ? `${parts[1]}/${parts[0].slice(2)}` : v
                  }}
                  minTickGap={40}
                />
                <YAxis
                  domain={[0, yMax]}
                  tick={{ fill: '#8a8f98', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  width={36}
                />
                <Tooltip content={<DarkTooltip />} />

                <Area
                  type="monotone"
                  dataKey="vix"
                  fill="rgba(41,98,255,0.12)"
                  stroke="none"
                />
                <Line
                  type="monotone"
                  dataKey="vix"
                  stroke="#2962FF"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 4, fill: '#2962FF' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Bottom legend */}
          <div className="shrink-0 px-3 py-1.5 border-t border-[var(--border)]">
            <div className="flex items-center gap-3 flex-wrap">
              {REGIMES.map(r => (
                <div key={r.label} className="flex items-center gap-1 text-[10px]">
                  <div className="w-2 h-2 rounded-sm" style={{ background: r.color }} />
                  <span className="text-[var(--text-tertiary)]">{r.min}-{r.max === 100 ? '...' : r.max}</span>
                  <span style={{ color: r.color }}>{r.label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
