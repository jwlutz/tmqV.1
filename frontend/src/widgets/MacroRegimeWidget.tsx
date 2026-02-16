import { useState, useEffect, useCallback } from 'react'
import { fetchMacroSeries } from '../api/client'
import { LoadingSkeleton, ErrorState, FREDNotConfigured } from './shared'
import type { WidgetDefinition } from './types'

interface Props {
  definition: WidgetDefinition
  width: number
  height: number
}

type Regime = 'goldilocks' | 'overheating' | 'stagflation' | 'deflation'

const REGIME_INFO: Record<Regime, { label: string; assets: string; color: string; bg: string }> = {
  goldilocks: { label: 'Goldilocks', assets: 'Equities, High Yield, Risk-On', color: '#00C853', bg: 'rgba(0, 200, 83, 0.15)' },
  overheating: { label: 'Overheating', assets: 'Commodities, TIPS, Short Duration', color: '#FF6D00', bg: 'rgba(255, 109, 0, 0.15)' },
  stagflation: { label: 'Stagflation', assets: 'Cash, Gold, Commodities', color: '#FFD600', bg: 'rgba(255, 214, 0, 0.15)' },
  deflation: { label: 'Deflation', assets: 'Long Bonds, USD, Quality', color: '#2962FF', bg: 'rgba(41, 98, 255, 0.15)' },
}

// Quadrant layout positions:
// top-left = stagflation, top-right = overheating
// bottom-left = deflation, bottom-right = goldilocks
const QUADRANT_ORDER: Regime[] = ['stagflation', 'overheating', 'deflation', 'goldilocks']

interface RegimeState {
  regime: Regime
  growthRoc: number
  inflationRoc: number
}

function classifyRegime(growthRoc: number, inflationRoc: number): Regime {
  const growthRising = growthRoc >= 0
  const inflationRising = inflationRoc >= 0

  if (growthRising && !inflationRising) return 'goldilocks'
  if (growthRising && inflationRising) return 'overheating'
  if (!growthRising && inflationRising) return 'stagflation'
  return 'deflation'
}

function computeRateOfChange(data: Array<{ date: string; value: number }>): number | null {
  if (data.length < 2) return null

  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date))
  const current = sorted[sorted.length - 1]

  // Find the data point closest to 6 months ago
  const currentDate = new Date(current.date)
  const sixMonthsAgo = new Date(currentDate)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const targetTime = sixMonthsAgo.getTime()

  let closest = sorted[0]
  let closestDiff = Math.abs(new Date(closest.date).getTime() - targetTime)

  for (const point of sorted) {
    const diff = Math.abs(new Date(point.date).getTime() - targetTime)
    if (diff < closestDiff) {
      closest = point
      closestDiff = diff
    }
  }

  if (closest.value === 0) return null
  return ((current.value - closest.value) / closest.value) * 100
}

function getActiveBg(regime: Regime): string {
  // Higher opacity version of the regime bg for the active quadrant
  switch (regime) {
    case 'goldilocks': return 'rgba(0, 200, 83, 0.3)'
    case 'overheating': return 'rgba(255, 109, 0, 0.3)'
    case 'stagflation': return 'rgba(255, 214, 0, 0.3)'
    case 'deflation': return 'rgba(41, 98, 255, 0.3)'
  }
}

function getGlowShadow(regime: Regime): string {
  const info = REGIME_INFO[regime]
  return `0 0 20px ${info.color}33, inset 0 0 12px ${info.color}1a`
}

/**
 * Computes a position dot offset within the active quadrant.
 * Centered = 0 magnitude, further from center = stronger signal.
 * Returns percentages for left/top positioning within the quadrant.
 */
function getDotPosition(regime: Regime, growthRoc: number, inflationRoc: number): { left: string; top: string } {
  // Clamp magnitudes to a reasonable range (0 to 5%)
  const growthMag = Math.min(Math.abs(growthRoc), 5) / 5
  const inflationMag = Math.min(Math.abs(inflationRoc), 5) / 5

  // Center of quadrant is 50%, 50%
  // Move toward the outer edge based on magnitude
  let left = 50
  let top = 50

  // Growth axis: right means more growth, left means less
  // Within each quadrant, stronger = further from the grid center
  if (regime === 'goldilocks' || regime === 'overheating') {
    // Right-side quadrants: stronger growth pushes right
    left = 50 + growthMag * 30
  } else {
    // Left-side quadrants: stronger contraction pushes left
    left = 50 - growthMag * 30
  }

  if (regime === 'overheating' || regime === 'stagflation') {
    // Top-row quadrants: stronger inflation pushes up
    top = 50 - inflationMag * 30
  } else {
    // Bottom-row quadrants: stronger deflation pushes down
    top = 50 + inflationMag * 30
  }

  return { left: `${left}%`, top: `${top}%` }
}

function Quadrant({
  regime,
  isActive,
  activeRegime,
  growthRoc,
  inflationRoc,
}: {
  regime: Regime
  isActive: boolean
  activeRegime: Regime
  growthRoc: number
  inflationRoc: number
}) {
  const info = REGIME_INFO[regime]
  const dotPos = isActive ? getDotPosition(regime, growthRoc, inflationRoc) : null

  return (
    <div
      className="relative flex flex-col items-center justify-center rounded-md transition-all duration-500"
      style={{
        backgroundColor: isActive ? getActiveBg(regime) : 'rgba(255, 255, 255, 0.03)',
        boxShadow: isActive ? getGlowShadow(activeRegime) : 'none',
        border: isActive ? `1px solid ${info.color}44` : '1px solid transparent',
        minHeight: 80,
      }}
    >
      {/* Regime label and dot */}
      <div className="flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            backgroundColor: isActive ? info.color : 'rgba(255, 255, 255, 0.15)',
          }}
        />
        <span
          className="text-xs font-semibold"
          style={{
            color: isActive ? info.color : 'rgba(255, 255, 255, 0.25)',
          }}
        >
          {info.label}
        </span>
      </div>

      {/* Position indicator dot in active quadrant */}
      {isActive && dotPos && (
        <span
          className="absolute w-3 h-3 rounded-full"
          style={{
            left: dotPos.left,
            top: dotPos.top,
            transform: 'translate(-50%, -50%)',
            backgroundColor: info.color,
            boxShadow: `0 0 8px ${info.color}88`,
          }}
        />
      )}
    </div>
  )
}

export function MacroRegimeWidget({ }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [regimeState, setRegimeState] = useState<RegimeState | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const end = new Date().toISOString().slice(0, 10)
    const start = new Date(Date.now() - 2 * 365 * 86400000).toISOString().slice(0, 10)

    try {
      const [indproRes, cpiRes] = await Promise.all([
        fetchMacroSeries('INDPRO', start, end),
        fetchMacroSeries('CPIAUCSL', start, end),
      ])

      const growthRoc = computeRateOfChange(indproRes.data)
      const inflationRoc = computeRateOfChange(cpiRes.data)

      if (growthRoc === null || inflationRoc === null) {
        setError('Insufficient data to compute regime')
        return
      }

      const regime = classifyRegime(growthRoc, inflationRoc)
      setRegimeState({ regime, growthRoc, inflationRoc })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch macro data'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <LoadingSkeleton label="Analyzing macro regime..." />
  if (error) {
    if (error.toLowerCase().includes('not configured') || error.toLowerCase().includes('configure')) return <FREDNotConfigured />
    return <ErrorState message={error} onRetry={load} />
  }
  if (!regimeState) return <ErrorState message="No regime data available" onRetry={load} />

  const { regime, growthRoc, inflationRoc } = regimeState
  const info = REGIME_INFO[regime]
  const growthRising = growthRoc >= 0
  const inflationRising = inflationRoc >= 0

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--bg-dark)] p-4 gap-4 overflow-auto">
      {/* Title */}
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
        Macro Regime Indicator
      </h3>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-2 gap-px w-full" style={{ maxWidth: 360 }}>
        {QUADRANT_ORDER.map(q => (
          <Quadrant
            key={q}
            regime={q}
            isActive={q === regime}
            activeRegime={regime}
            growthRoc={growthRoc}
            inflationRoc={inflationRoc}
          />
        ))}
      </div>

      {/* Axis labels */}
      <div className="flex items-center justify-between w-full text-[10px] text-[var(--text-tertiary)]" style={{ maxWidth: 360 }}>
        <span>Growth falling</span>
        <span>Growth rising</span>
      </div>

      {/* Info section */}
      <div className="flex flex-col gap-1.5 w-full" style={{ maxWidth: 360 }}>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-secondary)]">Current:</span>
          <span className="text-xs font-bold" style={{ color: info.color }}>
            {info.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-secondary)]">Growth:</span>
          <span
            className="text-xs font-mono font-medium"
            style={{ color: growthRising ? '#00C853' : '#FF1744' }}
          >
            {growthRoc >= 0 ? '+' : ''}{growthRoc.toFixed(1)}% ({growthRising ? 'rising' : 'falling'})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-secondary)]">Inflation:</span>
          <span
            className="text-xs font-mono font-medium"
            style={{ color: inflationRising ? '#FF6D00' : '#2962FF' }}
          >
            {inflationRoc >= 0 ? '+' : ''}{inflationRoc.toFixed(1)}% ({inflationRising ? 'rising' : 'falling'})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-secondary)]">Optimal:</span>
          <span className="text-xs font-medium" style={{ color: info.color }}>
            {info.assets}
          </span>
        </div>
      </div>
    </div>
  )
}
