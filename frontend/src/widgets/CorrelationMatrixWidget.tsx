import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { fetchOHLCV } from '../api/client'
import { LoadingSkeleton, ErrorState } from './shared'
import type { WidgetDefinition } from './types'

const CORRELATION_ASSETS = [
  { symbol: 'SPY', label: 'S&P 500', short: 'S&P' },
  { symbol: 'QQQ', label: 'Nasdaq', short: 'Nasd' },
  { symbol: 'IWM', label: 'Russell 2K', short: 'Russ' },
  { symbol: 'TLT', label: '20Y Bonds', short: 'Bond' },
  { symbol: 'GLD', label: 'Gold', short: 'Gold' },
  { symbol: 'BTC-USD', label: 'Bitcoin', short: 'BTC' },
  { symbol: 'UUP', label: 'USD', short: 'USD' },
] as const

type Window = 30 | 60 | 90

interface OHLCVBar {
  date: string
  close: number
}

interface AssetReturns {
  symbol: string
  label: string
  short: string
  returnsByDate: Map<string, number>
  error?: boolean
}

interface TooltipState {
  x: number
  y: number
  rowLabel: string
  colLabel: string
  corr: number
  window: number
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length
  if (n < 5) return NaN // need meaningful sample size

  // Use two-pass algorithm for better numerical stability
  const meanX = x.reduce((a, b) => a + b, 0) / n
  const meanY = y.reduce((a, b) => a + b, 0) / n

  let covXY = 0
  let varX = 0
  let varY = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    covXY += dx * dy
    varX += dx * dx
    varY += dy * dy
  }

  const den = Math.sqrt(varX * varY)
  if (den < 1e-15) return NaN
  return Math.max(-1, Math.min(1, covXY / den))
}

function corrToColor(corr: number, isDiagonal: boolean): string {
  if (isDiagonal) return '#2a2a3e'

  // Clamp -1 to +1
  const c = Math.max(-1, Math.min(1, corr))
  const t = (c + 1) / 2 // 0 = deep blue, 0.5 = neutral, 1 = deep red

  if (t < 0.5) {
    // Blue (#1565C0) to neutral (#2a2a3e)
    const u = t / 0.5
    const r = Math.round(21 + (42 - 21) * u)
    const g = Math.round(101 + (42 - 101) * u)
    const b = Math.round(192 + (62 - 192) * u)
    return `rgb(${r}, ${g}, ${b})`
  } else {
    // Neutral (#2a2a3e) to red (#C62828)
    const u = (t - 0.5) / 0.5
    const r = Math.round(42 + (198 - 42) * u)
    const g = Math.round(42 + (40 - 42) * u)
    const b = Math.round(62 + (40 - 62) * u)
    return `rgb(${r}, ${g}, ${b})`
  }
}

function corrTextColor(corr: number, isDiagonal: boolean): string {
  if (isDiagonal) return 'rgba(255,255,255,0.4)'
  const abs = Math.abs(corr)
  return abs > 0.5 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)'
}

interface CorrelationMatrixWidgetProps {
  definition: WidgetDefinition
  width: number
  height: number
}

export function CorrelationMatrixWidget({ definition }: CorrelationMatrixWidgetProps) {
  const [assetReturns, setAssetReturns] = useState<AssetReturns[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [window, setWindow] = useState<Window>(30)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const end = new Date().toISOString().slice(0, 10)
    const start = new Date(Date.now() - 200 * 86400000).toISOString().slice(0, 10) // ~7 months for 90d window

    try {
      const results = await Promise.allSettled(
        CORRELATION_ASSETS.map(async (a) => {
          const res = await fetchOHLCV(a.symbol, '1d', start, end)
          const bars = res.data as OHLCVBar[]

          // Compute daily returns
          const returnsByDate = new Map<string, number>()
          for (let i = 1; i < bars.length; i++) {
            const prev = bars[i - 1].close
            if (prev !== 0) {
              returnsByDate.set(bars[i].date, (bars[i].close - prev) / prev)
            }
          }

          return { symbol: a.symbol, label: a.label, short: a.short, returnsByDate }
        })
      )

      const data: AssetReturns[] = results.map((r, i) => {
        if (r.status === 'fulfilled') return r.value
        return {
          symbol: CORRELATION_ASSETS[i].symbol,
          label: CORRELATION_ASSETS[i].label,
          short: CORRELATION_ASSETS[i].short,
          returnsByDate: new Map(),
          error: true,
        }
      })

      setAssetReturns(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  if (loading) return <LoadingSkeleton label="Loading correlation data..." />
  if (error) return <ErrorState message={error} onRetry={loadData} />

  // Find common dates across all non-errored assets
  const validAssets = assetReturns.filter(a => !a.error && a.returnsByDate.size > 0)
  if (validAssets.length < 2) {
    return <ErrorState message="Not enough data to compute correlations" onRetry={loadData} />
  }

  // Inner join on dates
  let commonDates: string[] = []
  if (validAssets.length > 0) {
    const allDateSets = validAssets.map(a => new Set(a.returnsByDate.keys()))
    const first = allDateSets[0]
    commonDates = [...first].filter(d => allDateSets.every(s => s.has(d))).sort()
  }

  // Take last `window` dates
  const windowDates = commonDates.slice(-window)

  // Build correlation matrix
  const n = assetReturns.length
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0))

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1
        continue
      }

      const ai = assetReturns[i]
      const aj = assetReturns[j]

      if (ai.error || aj.error) {
        matrix[i][j] = 0
        matrix[j][i] = 0
        continue
      }

      // Only use dates where both assets have actual return data
      const pairedReturns: { xi: number; xj: number }[] = []
      for (const d of windowDates) {
        const ri = ai.returnsByDate.get(d)
        const rj = aj.returnsByDate.get(d)
        if (ri !== undefined && rj !== undefined) {
          pairedReturns.push({ xi: ri, xj: rj })
        }
      }

      const xi = pairedReturns.map(p => p.xi)
      const xj = pairedReturns.map(p => p.xj)
      const corr = pearsonCorrelation(xi, xj)
      matrix[i][j] = isNaN(corr) ? 0 : corr
      matrix[j][i] = isNaN(corr) ? 0 : corr
    }
  }

  // Average off-diagonal correlation
  let sumCorr = 0
  let countCorr = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!assetReturns[i].error && !assetReturns[j].error) {
        sumCorr += matrix[i][j]
        countCorr++
      }
    }
  }
  const avgCorr = countCorr > 0 ? sumCorr / countCorr : 0
  const highCorrelation = avgCorr > 0.7

  const gridSize = n + 1 // +1 for header row/col

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col bg-[var(--bg-dark)] overflow-hidden"
      style={{ position: 'relative' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <span className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wide">
          {definition.icon} Correlation Matrix
        </span>
        <div className="flex gap-1">
          {([30, 60, 90] as Window[]).map(w => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                w === window
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-white/5 text-[var(--text-secondary)] hover:bg-white/10'
              }`}
            >
              {w}d
            </button>
          ))}
        </div>
      </div>

      {/* Matrix grid */}
      <div className="flex-1 min-h-0 px-2 pb-1 overflow-auto flex items-center justify-center">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `minmax(40px, 0.8fr) repeat(${n}, 1fr)`,
            gridTemplateRows: `auto repeat(${n}, 1fr)`,
            gap: '2px',
            width: '100%',
            maxWidth: `${gridSize * 56}px`,
          }}
        >
          {/* Empty top-left cell */}
          <div />

          {/* Column headers */}
          {assetReturns.map(a => (
            <div
              key={`col-${a.symbol}`}
              className="flex items-center justify-center text-[10px] font-medium text-[var(--text-secondary)] py-1"
            >
              {a.short}
            </div>
          ))}

          {/* Rows */}
          {assetReturns.map((rowAsset, i) => (
            <Fragment key={rowAsset.symbol}>
              {/* Row header */}
              <div
                className="flex items-center justify-end pr-1 text-[10px] font-medium text-[var(--text-secondary)]"
              >
                {rowAsset.short}
              </div>

              {/* Cells */}
              {assetReturns.map((colAsset, j) => {
                const isDiag = i === j
                const corr = matrix[i][j]
                const hasError = rowAsset.error || colAsset.error

                return (
                  <div
                    key={`${i}-${j}`}
                    className="flex items-center justify-center rounded-sm cursor-default transition-transform hover:scale-105"
                    style={{
                      backgroundColor: hasError ? '#1a1a2e' : corrToColor(corr, isDiag),
                      aspectRatio: '1',
                      minHeight: '28px',
                    }}
                    onMouseEnter={(e) => {
                      const rect = containerRef.current?.getBoundingClientRect()
                      if (rect) {
                        setTooltip({
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top,
                          rowLabel: rowAsset.label,
                          colLabel: colAsset.label,
                          corr,
                          window,
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
                    <span
                      className="text-[10px] font-mono font-medium"
                      style={{ color: hasError ? 'rgba(255,255,255,0.2)' : corrTextColor(corr, isDiag) }}
                    >
                      {hasError ? '—' : isDiag ? '1.00' : corr.toFixed(2)}
                    </span>
                  </div>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Footer — Average correlation */}
      <div className="flex items-center justify-center gap-2 px-3 py-1.5 border-t border-[var(--border)] shrink-0">
        <span className="text-[10px] text-[var(--text-secondary)]">Avg Correlation:</span>
        <span
          className="text-xs font-bold font-mono"
          style={{ color: highCorrelation ? '#FF1744' : 'var(--text-primary)' }}
        >
          {avgCorr.toFixed(2)}
        </span>
        {highCorrelation && (
          <span className="text-[10px] text-[#FF1744] font-medium">
            — Diversification breakdown
          </span>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-50 pointer-events-none rounded-lg px-3 py-2 border border-[var(--border)] shadow-xl"
          style={{
            left: Math.min(tooltip.x + 12, (containerRef.current?.clientWidth || 300) - 200),
            top: Math.min(tooltip.y + 12, (containerRef.current?.clientHeight || 300) - 70),
            backgroundColor: '#1a1f2e',
          }}
        >
          <div className="text-xs font-semibold text-[var(--text-primary)]">
            {tooltip.rowLabel} vs {tooltip.colLabel}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
            Correlation ({tooltip.window}d): <span className="font-mono font-medium text-[var(--text-primary)]">{tooltip.corr.toFixed(4)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
