import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchOHLCV } from '../api/client'
import { LoadingSkeleton, ErrorState } from './shared'
import type { WidgetDefinition } from './types'

const SECTOR_ETFS = [
  { symbol: 'XLK', name: 'Technology', short: 'Tech' },
  { symbol: 'XLF', name: 'Financials', short: 'Fins' },
  { symbol: 'XLV', name: 'Healthcare', short: 'Health' },
  { symbol: 'XLE', name: 'Energy', short: 'Energy' },
  { symbol: 'XLY', name: 'Consumer Disc.', short: 'Disc.' },
  { symbol: 'XLP', name: 'Consumer Staples', short: 'Stpls' },
  { symbol: 'XLI', name: 'Industrials', short: 'Indus' },
  { symbol: 'XLB', name: 'Materials', short: 'Matls' },
  { symbol: 'XLU', name: 'Utilities', short: 'Utils' },
  { symbol: 'XLRE', name: 'Real Estate', short: 'RE' },
  { symbol: 'XLC', name: 'Communication', short: 'Comm' },
] as const

type Timeframe = '1D' | '1W' | '1M' | 'YTD'

const OFFENSIVE = new Set(['XLK', 'XLY', 'XLF', 'XLC'])
const DEFENSIVE = new Set(['XLP', 'XLV', 'XLU', 'XLRE'])

interface OHLCVBar {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface SectorData {
  symbol: string
  name: string
  short: string
  bars: OHLCVBar[]
  error?: string
}

interface SectorPerf {
  symbol: string
  name: string
  short: string
  perf: number
  volumeChange: number
}

function getPerformance(bars: OHLCVBar[], tf: Timeframe): { perf: number; volumeChange: number } {
  if (bars.length < 2) return { perf: 0, volumeChange: 0 }

  const last = bars[bars.length - 1]
  let refIdx: number

  switch (tf) {
    case '1D':
      refIdx = bars.length - 2
      break
    case '1W':
      refIdx = Math.max(0, bars.length - 6)
      break
    case '1M':
      refIdx = Math.max(0, bars.length - 22)
      break
    case 'YTD': {
      const currentYear = new Date().getFullYear().toString()
      refIdx = bars.findIndex(b => b.date.startsWith(currentYear))
      if (refIdx < 0) refIdx = 0
      break
    }
  }

  const ref = bars[refIdx]
  const perf = ref.close !== 0 ? (last.close - ref.close) / ref.close : 0

  const recentVol = bars.slice(-5).reduce((s, b) => s + b.volume, 0) / 5
  const priorVol = bars.slice(Math.max(0, bars.length - 10), bars.length - 5).reduce((s, b) => s + b.volume, 0) / 5
  const volumeChange = priorVol > 0 ? (recentVol - priorVol) / priorVol : 0

  return { perf, volumeChange }
}

function perfToColor(perf: number): string {
  // Clamp to -3% to +3% range for color mapping
  const clamped = Math.max(-0.03, Math.min(0.03, perf))
  const t = (clamped + 0.03) / 0.06 // 0 = deep red, 1 = deep green

  if (t < 0.5) {
    // Red (#FF1744) to neutral (#2a2a3e)
    const u = t / 0.5
    const r = Math.round(255 + (42 - 255) * u)
    const g = Math.round(23 + (42 - 23) * u)
    const b = Math.round(68 + (62 - 68) * u)
    return `rgb(${r}, ${g}, ${b})`
  } else {
    // Neutral (#2a2a3e) to green (#00C853)
    const u = (t - 0.5) / 0.5
    const r = Math.round(42 + (0 - 42) * u)
    const g = Math.round(42 + (200 - 42) * u)
    const b = Math.round(62 + (83 - 62) * u)
    return `rgb(${r}, ${g}, ${b})`
  }
}

interface TooltipState {
  x: number
  y: number
  sector: SectorPerf
}

interface SectorHeatmapWidgetProps {
  definition: WidgetDefinition
  width: number
  height: number
}

export function SectorHeatmapWidget({ definition }: SectorHeatmapWidgetProps) {
  const [sectorData, setSectorData] = useState<SectorData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeframe, setTimeframe] = useState<Timeframe>('1D')
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const end = new Date().toISOString().slice(0, 10)
    const start = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)

    try {
      const results = await Promise.allSettled(
        SECTOR_ETFS.map(async (s) => {
          const res = await fetchOHLCV(s.symbol, '1d', start, end)
          return { ...s, bars: res.data as OHLCVBar[] }
        })
      )

      const data: SectorData[] = results.map((r, i) => {
        if (r.status === 'fulfilled') return r.value
        return { ...SECTOR_ETFS[i], bars: [], error: 'Failed to load' }
      })

      setSectorData(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch sector data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  if (loading) return <LoadingSkeleton label="Loading sector data..." />
  if (error) return <ErrorState message={error} onRetry={loadData} />

  // Compute performance for current timeframe, sorted best→worst
  const sectors: SectorPerf[] = sectorData
    .filter(s => s.bars.length > 0)
    .map(s => {
      const { perf, volumeChange } = getPerformance(s.bars, timeframe)
      return { symbol: s.symbol, name: s.name, short: s.short, perf, volumeChange }
    })
    .sort((a, b) => b.perf - a.perf)

  // Offensive / Defensive ratio
  const offAvg = sectors.filter(s => OFFENSIVE.has(s.symbol))
  const defAvg = sectors.filter(s => DEFENSIVE.has(s.symbol))
  const offMean = offAvg.length > 0 ? offAvg.reduce((s, x) => s + x.perf, 0) / offAvg.length : 0
  const defMean = defAvg.length > 0 ? defAvg.reduce((s, x) => s + x.perf, 0) / defAvg.length : 0
  // Use absolute perf for ratio — avoid division by zero or negative
  const offAbs = Math.abs(offMean) + 0.0001
  const defAbs = Math.abs(defMean) + 0.0001
  const riskRatio = offMean >= 0 && defMean >= 0
    ? offAbs / defAbs
    : offMean >= 0 && defMean < 0
      ? 2.0 // offensive up, defensive down = very risk-on
      : offMean < 0 && defMean >= 0
        ? 0.5 // offensive down, defensive up = very risk-off
        : defAbs / offAbs // both negative — less negative offensive = risk-on
  const isRiskOn = riskRatio > 1

  const cols = 4

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col bg-[var(--bg-dark)] overflow-hidden"
      style={{ position: 'relative' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <span className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wide">
          {definition.icon} Sector Performance
        </span>
        <div className="flex gap-1">
          {(['1D', '1W', '1M', 'YTD'] as Timeframe[]).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                tf === timeframe
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-white/5 text-[var(--text-secondary)] hover:bg-white/10'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div
        className="flex-1 min-h-0 px-2 pb-1 overflow-auto"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: '3px',
          alignContent: 'start',
        }}
      >
        {sectors.map(s => (
          <div
            key={s.symbol}
            className="rounded-md flex flex-col items-center justify-center cursor-default transition-transform hover:scale-[1.02]"
            style={{
              backgroundColor: perfToColor(s.perf),
              padding: '8px 4px',
              minHeight: '56px',
            }}
            onMouseEnter={(e) => {
              const rect = containerRef.current?.getBoundingClientRect()
              if (rect) {
                setTooltip({
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                  sector: s,
                })
              }
            }}
            onMouseMove={(e) => {
              const rect = containerRef.current?.getBoundingClientRect()
              if (rect) {
                setTooltip(prev => prev ? {
                  ...prev,
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                } : null)
              }
            }}
            onMouseLeave={() => setTooltip(null)}
          >
            <span className="text-[10px] text-white/70 font-medium leading-tight">{s.short}</span>
            <span className="text-sm font-bold text-white leading-tight">
              {s.perf >= 0 ? '+' : ''}{(s.perf * 100).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>

      {/* Footer — Offensive/Defensive ratio */}
      <div className="flex items-center justify-center gap-2 px-3 py-1.5 border-t border-[var(--border)] shrink-0">
        <span className="text-[10px] text-[var(--text-secondary)]">Risk Appetite:</span>
        <span
          className="text-xs font-bold"
          style={{ color: isRiskOn ? '#00C853' : '#FF1744' }}
        >
          {riskRatio.toFixed(2)} — {isRiskOn ? 'Risk-On' : 'Risk-Off'}
        </span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-50 pointer-events-none rounded-lg px-3 py-2 border border-[var(--border)] shadow-xl"
          style={{
            left: Math.min(tooltip.x + 12, (containerRef.current?.clientWidth || 300) - 180),
            top: Math.min(tooltip.y + 12, (containerRef.current?.clientHeight || 300) - 80),
            backgroundColor: '#1a1f2e',
          }}
        >
          <div className="text-xs font-semibold text-[var(--text-primary)]">
            {tooltip.sector.symbol} — {tooltip.sector.name}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
            Performance: <span className="font-mono" style={{ color: tooltip.sector.perf >= 0 ? '#00C853' : '#FF1744' }}>
              {tooltip.sector.perf >= 0 ? '+' : ''}{(tooltip.sector.perf * 100).toFixed(3)}%
            </span>
          </div>
          <div className="text-[11px] text-[var(--text-secondary)]">
            Volume Chg: <span className="font-mono">
              {tooltip.sector.volumeChange >= 0 ? '+' : ''}{(tooltip.sector.volumeChange * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
