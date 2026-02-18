import { useState, useCallback, useMemo } from 'react'
import { indicatorRegistry } from 'lightweight-charts-indicators'
import type { Bar } from 'oakscriptjs'
import type { Candle } from './useMarketData'

// ── Types ──────────────────────────────────────────────────────────────

export interface IndicatorConfig {
  id: string           // registry id like 'sma', 'rsi', 'macd'
  label: string        // display name from the registry
  shortLabel: string   // short name e.g. 'SMA'
  category: string     // 'Moving Averages', 'Oscillators', etc.
  color: string        // assigned line color
  overlay: boolean     // true = overlay on price, false = separate pane
  pane: 'main' | 'separate'
  bounds?: { min: number; max: number }
  levels?: number[]
  inputConfig: unknown  // raw input config from registry for custom params
  defaultInputs: Record<string, unknown>
}

export interface IndicatorPlotPoint {
  time: number
  value: number
}

export interface IndicatorResult {
  config: IndicatorConfig
  plots: Record<string, IndicatorPlotPoint[]>  // plotId → data points
}

// ── Constants ──────────────────────────────────────────────────────────

// Color palette for auto-assigning indicator colors
const INDICATOR_COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#6366f1',
  '#a855f7', '#eab308', '#0ea5e9', '#f43f5e', '#10b981',
  '#64748b', '#fbbf24', '#84cc16', '#e879f9', '#fb923c',
]

// Known bounded oscillators (0-100 or similar)
const BOUNDED_INDICATORS: Record<string, { bounds: { min: number; max: number }; levels: number[] }> = {
  rsi: { bounds: { min: 0, max: 100 }, levels: [30, 70] },
  stochastic: { bounds: { min: 0, max: 100 }, levels: [20, 80] },
  stochrsi: { bounds: { min: 0, max: 100 }, levels: [20, 80] },
  mfi: { bounds: { min: 0, max: 100 }, levels: [20, 80] },
  williamspercentrange: { bounds: { min: -100, max: 0 }, levels: [-20, -80] },
  adx: { bounds: { min: 0, max: 100 }, levels: [25, 50] },
  aroon: { bounds: { min: 0, max: 100 }, levels: [30, 70] },
  chandemo: { bounds: { min: -100, max: 100 }, levels: [-50, 50] },
  ultimateoscillator: { bounds: { min: 0, max: 100 }, levels: [30, 70] },
  fishertransform: { bounds: { min: -4, max: 4 }, levels: [-1, 1] },
}

// Indicators with zero-line reference
const ZERO_LINE_INDICATORS = new Set([
  'macd', 'momentum', 'roc', 'bop', 'priceoscillator',
  'coppockcurve', 'trix', 'elderforceindex', 'cci',
  'chaikinmf', 'chaikinoscillator', 'easeofmovement',
  'klingeroscillator', 'volumeoscillator', 'ppo',
  'bbpercentb', 'bbbandwidth',
])

// ── Build registry ─────────────────────────────────────────────────────

function buildAvailableIndicators(): IndicatorConfig[] {
  let colorIdx = 0
  return indicatorRegistry.map(ind => {
    const color = INDICATOR_COLORS[colorIdx % INDICATOR_COLORS.length]
    colorIdx++

    const pane: 'main' | 'separate' = ind.overlay ? 'main' : 'separate'
    const bounded = BOUNDED_INDICATORS[ind.id]
    const hasZeroLine = ZERO_LINE_INDICATORS.has(ind.id)

    return {
      id: ind.id,
      label: ind.name,
      shortLabel: ind.shortName,
      category: ind.category,
      color,
      overlay: ind.overlay,
      pane,
      bounds: bounded ? bounded.bounds : undefined,
      levels: bounded ? bounded.levels : (hasZeroLine ? [0] : undefined),
      inputConfig: ind.inputConfig,
      defaultInputs: ind.defaultInputs,
    }
  })
}

export const AVAILABLE_INDICATORS = buildAvailableIndicators()

// Group indicators by category (computed once)
export const INDICATOR_CATEGORIES = AVAILABLE_INDICATORS.reduce<Record<string, IndicatorConfig[]>>(
  (acc, ind) => {
    if (!acc[ind.category]) acc[ind.category] = []
    acc[ind.category].push(ind)
    return acc
  }, {}
)

// ── Convert candles to bars ────────────────────────────────────────────

function candlesToBars(candles: Candle[]): Bar[] {
  return candles.map(c => ({
    time: c.time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume ?? 0,
  }))
}

// ── Custom indicator support ───────────────────────────────────────────

export interface CustomIndicator {
  id: string
  label: string
  color: string
  code: string // JS function body: (bars) => [{time, value}]
}

// ── Hook ───────────────────────────────────────────────────────────────

export interface UseIndicatorsOptions {
  candles: Candle[]
}

export function useIndicators({ candles }: UseIndicatorsOptions) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showVolume, setShowVolume] = useState(true)
  const [customIndicators, setCustomIndicators] = useState<CustomIndicator[]>([])

  // Memoize bars conversion
  const bars = useMemo(() => candlesToBars(candles), [candles])

  // Compute indicator results for all selected indicators
  const indicatorResults = useMemo<IndicatorResult[]>(() => {
    if (bars.length === 0) return []

    return selectedIds.map(id => {
      const config = AVAILABLE_INDICATORS.find(i => i.id === id)
      if (!config) return null

      const registryEntry = indicatorRegistry.find(i => i.id === id)
      if (!registryEntry) return null

      try {
        const result = registryEntry.calculate(bars, registryEntry.defaultInputs)
        const plots: Record<string, IndicatorPlotPoint[]> = {}

        // Convert each plot from the result
        for (const [plotKey, plotData] of Object.entries(result.plots)) {
          if (!Array.isArray(plotData)) continue
          const points: IndicatorPlotPoint[] = []
          for (let i = 0; i < plotData.length; i++) {
            const point = plotData[i] as { time: number; value: number }
            if (point.value !== undefined && !isNaN(point.value)) {
              points.push({ time: point.time, value: point.value })
            }
          }
          plots[plotKey] = points
        }

        return { config, plots } as IndicatorResult
      } catch (e) {
        console.warn(`Failed to compute indicator ${id}:`, e)
        return null
      }
    }).filter((r): r is IndicatorResult => r !== null)
  }, [selectedIds, bars])

  // Compute custom indicator results
  const customResults = useMemo<IndicatorResult[]>(() => {
    if (bars.length === 0 || customIndicators.length === 0) return []

    return customIndicators.map(custom => {
      try {
        // Create a safe function from the user's code
        const fn = new Function('bars', custom.code) as (bars: Bar[]) => Array<{ time: number; value: number }>
        const values = fn(bars)

        if (!Array.isArray(values)) return null

        const config: IndicatorConfig = {
          id: custom.id,
          label: custom.label,
          shortLabel: custom.label,
          category: 'Custom',
          color: custom.color,
          overlay: false,
          pane: 'separate',
          inputConfig: null,
          defaultInputs: {},
        }

        const points = values
          .filter(v => v && typeof v.time === 'number' && typeof v.value === 'number' && !isNaN(v.value))
          .map(v => ({ time: v.time, value: v.value }))

        const plots: Record<string, IndicatorPlotPoint[]> = { plot0: points }
        return { config, plots } as IndicatorResult
      } catch (e) {
        console.warn(`Custom indicator "${custom.label}" failed:`, e)
        return null
      }
    }).filter(Boolean) as IndicatorResult[]
  }, [customIndicators, bars])

  // All active results (built-in + custom)
  const activeIndicators = useMemo(() => {
    return [...indicatorResults, ...customResults]
  }, [indicatorResults, customResults])

  const toggleIndicator = useCallback((id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }, [])

  const clearIndicators = useCallback(() => {
    setSelectedIds([])
  }, [])

  const toggleVolume = useCallback(() => {
    setShowVolume(prev => !prev)
  }, [])

  const addCustomIndicator = useCallback((indicator: CustomIndicator) => {
    setCustomIndicators(prev => [...prev, indicator])
  }, [])

  const removeCustomIndicator = useCallback((id: string) => {
    setCustomIndicators(prev => prev.filter(i => i.id !== id))
  }, [])

  return {
    selectedIds,
    toggleIndicator,
    clearIndicators,
    activeIndicators,
    availableIndicators: AVAILABLE_INDICATORS,
    indicatorCategories: INDICATOR_CATEGORIES,
    isLoading: false, // client-side = always synchronous
    showVolume,
    toggleVolume,
    customIndicators,
    addCustomIndicator,
    removeCustomIndicator,
  }
}
