import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { fetchMacroMultiple } from '../api/client'
import { LoadingSkeleton, ErrorState, FREDNotConfigured } from './shared'
import type { WidgetDefinition } from './types'

interface Props {
  definition: WidgetDefinition
  width: number
  height: number
}

const YIELD_CURVE_SERIES = [
  { id: 'DGS1MO', label: '1M', maturity: 1 / 12 },
  { id: 'DGS3MO', label: '3M', maturity: 0.25 },
  { id: 'DGS6MO', label: '6M', maturity: 0.5 },
  { id: 'DGS1', label: '1Y', maturity: 1 },
  { id: 'DGS2', label: '2Y', maturity: 2 },
  { id: 'DGS3', label: '3Y', maturity: 3 },
  { id: 'DGS5', label: '5Y', maturity: 5 },
  { id: 'DGS7', label: '7Y', maturity: 7 },
  { id: 'DGS10', label: '10Y', maturity: 10 },
  { id: 'DGS20', label: '20Y', maturity: 20 },
  { id: 'DGS30', label: '30Y', maturity: 30 },
]

const SERIES_IDS = YIELD_CURVE_SERIES.map(s => s.id)

interface CurvePoint {
  label: string
  yield: number | null
  compareYield?: number | null
}

interface RawRow {
  date: string
  [key: string]: string | number
}

function extractCurve(row: RawRow): CurvePoint[] {
  return YIELD_CURVE_SERIES.map(s => {
    const val = row[s.id]
    return {
      label: s.label,
      yield: val != null && val !== '' ? Number(val) : null,
    }
  })
}

function getSpread(row: RawRow, longId: string, shortId: string): number | null {
  const long = row[longId]
  const short = row[shortId]
  if (long == null || short == null || long === '' || short === '') return null
  return Number(long) - Number(short)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1f2e] border border-[var(--border)] rounded px-2.5 py-1.5 shadow-lg">
      <div className="text-[11px] text-[var(--text-secondary)] mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-1.5 text-[11px]">
          <div className="w-2 h-2 rounded-full" style={{ background: p.stroke }} />
          <span className="text-[var(--text-primary)]">{p.value != null ? `${Number(p.value).toFixed(3)}%` : 'N/A'}</span>
        </div>
      ))}
    </div>
  )
}

export function YieldCurveWidget({}: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const allDataRef = useRef<RawRow[]>([])
  const [allDates, setAllDates] = useState<string[]>([])
  const [curveData, setCurveData] = useState<CurvePoint[]>([])
  const [compareEnabled, setCompareEnabled] = useState(false)
  const [compareIndex, setCompareIndex] = useState(0)
  const [spread10y2y, setSpread10y2y] = useState<number | null>(null)
  const [spread10y3m, setSpread10y3m] = useState<number | null>(null)
  const [isInverted, setIsInverted] = useState(false)
  const [currentDate, setCurrentDate] = useState('')

  const sliderDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (sliderDebounceRef.current) clearTimeout(sliderDebounceRef.current)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const end = new Date()
      const start = new Date()
      start.setFullYear(start.getFullYear() - 2)

      const res = await fetchMacroMultiple(
        SERIES_IDS,
        start.toISOString().split('T')[0],
        end.toISOString().split('T')[0],
      )

      const rows = (res.data as RawRow[])
        .filter(r => r.date)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))

      allDataRef.current = rows

      const dates = rows.map(r => String(r.date))
      setAllDates(dates)

      // Set current curve to latest date with valid data
      if (rows.length > 0) {
        const latest = rows[rows.length - 1]
        setCurrentDate(String(latest.date))
        setCurveData(extractCurve(latest))
        setSpread10y2y(getSpread(latest, 'DGS10', 'DGS2'))
        setSpread10y3m(getSpread(latest, 'DGS10', 'DGS3MO'))
        const s = getSpread(latest, 'DGS10', 'DGS2')
        setIsInverted(s !== null && s < 0)
        setCompareIndex(Math.max(0, rows.length - 1 - 252)) // ~1 year ago default
      }

      setLoading(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load yield curve'
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

  // Update curve when compare slider changes
  const updateCompare = useCallback((idx: number) => {
    const rows = allDataRef.current
    if (rows.length === 0) return

    const latest = rows[rows.length - 1]
    const compareRow = rows[idx]
    if (!compareRow) return

    const compareCurve = extractCurve(compareRow)
    const currentCurve = extractCurve(latest)

    const merged: CurvePoint[] = currentCurve.map((p, i) => ({
      ...p,
      compareYield: compareCurve[i]?.yield ?? null,
    }))

    setCurveData(merged)
  }, [])

  const handleSliderChange = useCallback((val: number) => {
    setCompareIndex(val)
    if (sliderDebounceRef.current) clearTimeout(sliderDebounceRef.current)
    sliderDebounceRef.current = setTimeout(() => updateCompare(val), 30)
  }, [updateCompare])

  // When compare is toggled on/off, update the curve accordingly.
  // Slider scrubbing is handled by handleSliderChange's debounce, not this effect.
  useEffect(() => {
    if (!compareEnabled) {
      const rows = allDataRef.current
      if (rows.length > 0) {
        setCurveData(extractCurve(rows[rows.length - 1]))
      }
    } else {
      updateCompare(compareIndex)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareEnabled, updateCompare])

  const compareDate = useMemo(() => {
    if (!compareEnabled || allDates.length === 0) return ''
    return allDates[compareIndex] || ''
  }, [compareEnabled, compareIndex, allDates])

  // Check for inversions in the current curve
  const inversionSegments = useMemo(() => {
    const segments: number[] = []
    for (let i = 1; i < curveData.length; i++) {
      const prev = curveData[i - 1].yield
      const curr = curveData[i].yield
      if (prev != null && curr != null && curr < prev) {
        segments.push(i)
      }
    }
    return segments
  }, [curveData])

  if (error === 'fred_not_configured') return <FREDNotConfigured />

  return (
    <div className="w-full h-full flex flex-col bg-[var(--bg-dark)]">
      {/* Loading / Error */}
      {loading && <LoadingSkeleton label="Loading yield curve..." />}
      {error && error !== 'fred_not_configured' && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && (
        <>
          {/* Header bar */}
          <div className="flex items-center justify-between px-3 py-1.5 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                US Treasury Yield Curve
              </span>
              <span className="text-[10px] text-[var(--text-tertiary)]">{currentDate}</span>
              {isInverted && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--red-down)]/15 text-[var(--red-down)] border border-[var(--red-down)]/30">
                  Curve Inverted (2Y/10Y)
                </span>
              )}
            </div>
            {/* Compare toggle */}
            <button
              onClick={() => setCompareEnabled(v => !v)}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                compareEnabled
                  ? 'bg-[#FF6D00]/20 text-[#FF6D00] border border-[#FF6D00]/30'
                  : 'bg-white/5 text-[var(--text-tertiary)] hover:bg-white/10'
              }`}
            >
              Compare
            </button>
          </div>

          {/* Chart */}
          <div className="flex-1 min-h-0 px-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curveData} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#8a8f98', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fill: '#8a8f98', fontSize: 11 }}
                  tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  width={48}
                />
                <Tooltip content={<DarkTooltip />} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
                <Line
                  type="monotone"
                  dataKey="yield"
                  stroke="#2962FF"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#2962FF', stroke: '#2962FF' }}
                  activeDot={{ r: 5, fill: '#2962FF' }}
                  connectNulls
                  name="Current"
                />
                {compareEnabled && (
                  <Line
                    type="monotone"
                    dataKey="compareYield"
                    stroke="#FF6D00"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 3, fill: '#FF6D00', stroke: '#FF6D00' }}
                    activeDot={{ r: 5, fill: '#FF6D00' }}
                    connectNulls
                    name="Compare"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bottom controls */}
          <div className="shrink-0 px-3 py-1.5 border-t border-[var(--border)]">
            {/* Date slider for comparison */}
            {compareEnabled && allDates.length > 0 && (
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] text-[#FF6D00] shrink-0 w-20 font-mono">
                  {compareDate}
                </span>
                <input
                  type="range"
                  min={0}
                  max={allDates.length - 1}
                  value={compareIndex}
                  onChange={e => handleSliderChange(Number(e.target.value))}
                  className="flex-1 h-1 accent-[#FF6D00] cursor-pointer"
                  style={{ accentColor: '#FF6D00' }}
                />
              </div>
            )}

            {/* Spreads & inversion info */}
            <div className="flex items-center gap-4">
              {spread10y2y !== null && (
                <div className="flex items-center gap-1 text-[10px]">
                  <span className="text-[var(--text-tertiary)]">10Y-2Y:</span>
                  <span className={spread10y2y >= 0 ? 'text-[var(--green-up)]' : 'text-[var(--red-down)]'}>
                    {spread10y2y >= 0 ? '+' : ''}{spread10y2y.toFixed(2)}%
                  </span>
                </div>
              )}
              {spread10y3m !== null && (
                <div className="flex items-center gap-1 text-[10px]">
                  <span className="text-[var(--text-tertiary)]">10Y-3M:</span>
                  <span className={spread10y3m >= 0 ? 'text-[var(--green-up)]' : 'text-[var(--red-down)]'}>
                    {spread10y3m >= 0 ? '+' : ''}{spread10y3m.toFixed(2)}%
                  </span>
                </div>
              )}
              {inversionSegments.length > 0 && (
                <span className="text-[10px] text-[var(--red-down)]">
                  {inversionSegments.length} inverted segment{inversionSegments.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
