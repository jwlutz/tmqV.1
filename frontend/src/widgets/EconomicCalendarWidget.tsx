import { useState, useEffect, useCallback } from 'react'
import { fetchMacroSeries } from '../api/client'
import { LoadingSkeleton, ErrorState, FREDNotConfigured } from './shared'
import type { WidgetDefinition } from './types'

interface Release {
  name: string
  series_id: string
  frequency: 'monthly' | 'weekly' | 'quarterly'
  typical_release_day: number
  impact: 'high' | 'medium' | 'low'
  affects: string[]
}

const MAJOR_RELEASES: Release[] = [
  { name: 'CPI', series_id: 'CPIAUCSL', frequency: 'monthly', typical_release_day: 10, impact: 'high', affects: ['equities', 'bonds', 'crypto', 'fx'] },
  { name: 'Core CPI', series_id: 'CPILFESL', frequency: 'monthly', typical_release_day: 10, impact: 'high', affects: ['equities', 'bonds'] },
  { name: 'Nonfarm Payrolls', series_id: 'PAYEMS', frequency: 'monthly', typical_release_day: 3, impact: 'high', affects: ['equities', 'bonds', 'fx'] },
  { name: 'Unemployment Rate', series_id: 'UNRATE', frequency: 'monthly', typical_release_day: 3, impact: 'high', affects: ['equities', 'bonds', 'fx'] },
  { name: 'Initial Claims', series_id: 'ICSA', frequency: 'weekly', typical_release_day: 4, impact: 'medium', affects: ['equities', 'bonds'] },
  { name: 'GDP (Advance)', series_id: 'GDP', frequency: 'quarterly', typical_release_day: 25, impact: 'high', affects: ['equities', 'bonds', 'fx'] },
  { name: 'PCE Price Index', series_id: 'PCEPI', frequency: 'monthly', typical_release_day: 27, impact: 'high', affects: ['equities', 'bonds'] },
  { name: 'Consumer Sentiment', series_id: 'UMCSENT', frequency: 'monthly', typical_release_day: 14, impact: 'medium', affects: ['equities'] },
  { name: 'Industrial Production', series_id: 'INDPRO', frequency: 'monthly', typical_release_day: 16, impact: 'medium', affects: ['equities'] },
  { name: 'Housing Starts', series_id: 'HOUST', frequency: 'monthly', typical_release_day: 18, impact: 'low', affects: ['equities'] },
]

interface CalendarEntry {
  release: Release
  date: Date
  latest: number | null
  previous: number | null
  isUpcoming: boolean
}

function formatValue(seriesId: string, value: number | null): string {
  if (value === null) return '\u2014'
  switch (seriesId) {
    case 'CPIAUCSL':
    case 'CPILFESL':
    case 'PCEPI':
      return value.toFixed(1)
    case 'UNRATE':
      return `${value.toFixed(1)}%`
    case 'PAYEMS':
      return `${(value / 1000).toFixed(0)}K`
    case 'ICSA':
      return `${(value / 1000).toFixed(0)}K`
    case 'GDP':
      return value.toFixed(1)
    case 'UMCSENT':
      return value.toFixed(1)
    case 'INDPRO':
      return value.toFixed(1)
    case 'HOUST':
      return `${(value / 1000).toFixed(0)}K`
    default:
      return value.toFixed(2)
  }
}

function formatDate(date: Date, now: Date): string {
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays > 1 && diffDays <= 7) return `in ${diffDays}d`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getNextReleaseDate(release: Release, now: Date): Date {
  const year = now.getFullYear()
  const month = now.getMonth()

  if (release.frequency === 'weekly') {
    // Next occurrence of typical_release_day (0=Sun ... 4=Thu)
    const d = new Date(year, month, now.getDate())
    const dayOfWeek = d.getDay()
    let daysUntil = release.typical_release_day - dayOfWeek
    if (daysUntil <= 0) daysUntil += 7
    d.setDate(d.getDate() + daysUntil)
    return d
  }

  if (release.frequency === 'quarterly') {
    // Next quarter month (Jan, Apr, Jul, Oct) on typical day
    const quarterMonths = [0, 3, 6, 9]
    for (const qm of quarterMonths) {
      const candidate = new Date(year, qm, release.typical_release_day)
      if (candidate > now) return candidate
    }
    return new Date(year + 1, 0, release.typical_release_day)
  }

  // Monthly: try this month's day, else next month
  const thisMonth = new Date(year, month, release.typical_release_day)
  if (thisMonth > now) return thisMonth
  return new Date(year, month + 1, release.typical_release_day)
}

function getPreviousReleaseDate(release: Release, now: Date): Date {
  const year = now.getFullYear()
  const month = now.getMonth()

  if (release.frequency === 'weekly') {
    const d = new Date(year, month, now.getDate())
    const dayOfWeek = d.getDay()
    let daysBack = dayOfWeek - release.typical_release_day
    if (daysBack <= 0) daysBack += 7
    d.setDate(d.getDate() - daysBack)
    return d
  }

  if (release.frequency === 'quarterly') {
    const quarterMonths = [0, 3, 6, 9]
    for (let i = quarterMonths.length - 1; i >= 0; i--) {
      const candidate = new Date(year, quarterMonths[i], release.typical_release_day)
      if (candidate <= now) return candidate
    }
    return new Date(year - 1, 9, release.typical_release_day)
  }

  const thisMonth = new Date(year, month, release.typical_release_day)
  if (thisMonth <= now) return thisMonth
  return new Date(year, month - 1, release.typical_release_day)
}

const IMPACT_COLORS: Record<string, string> = {
  high: '#FF1744',
  medium: '#FF9100',
  low: '#4CAF50',
}

const IMPACT_DOTS: Record<string, string> = {
  high: '\u{1F534}',
  medium: '\u{1F7E1}',
  low: '\u{1F7E2}',
}

const AFFECT_COLORS: Record<string, string> = {
  equities: '#2962FF',
  bonds: '#FF6D00',
  crypto: '#AB47BC',
  fx: '#00BFA5',
}

interface EconomicCalendarWidgetProps {
  definition: WidgetDefinition
  width: number
  height: number
}

export function EconomicCalendarWidget({ }: EconomicCalendarWidgetProps) {
  const [tab, setTab] = useState<'upcoming' | 'recent'>('upcoming')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [entries, setEntries] = useState<CalendarEntry[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const now = new Date()
      const threeMonthsAgo = new Date(now)
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
      const startStr = threeMonthsAgo.toISOString().split('T')[0]
      const endStr = now.toISOString().split('T')[0]

      const results = await Promise.allSettled(
        MAJOR_RELEASES.map(r => fetchMacroSeries(r.series_id, startStr, endStr))
      )

      const allEntries: CalendarEntry[] = []

      for (let i = 0; i < MAJOR_RELEASES.length; i++) {
        const release = MAJOR_RELEASES[i]
        const result = results[i]

        let latest: number | null = null
        let previous: number | null = null

        if (result.status === 'fulfilled' && result.value.data.length > 0) {
          const sorted = [...result.value.data].sort((a, b) => a.date.localeCompare(b.date))
          latest = sorted[sorted.length - 1].value
          if (sorted.length >= 2) {
            previous = sorted[sorted.length - 2].value
          }
        }

        // Upcoming entry
        const nextDate = getNextReleaseDate(release, now)
        allEntries.push({ release, date: nextDate, latest: null, previous: latest, isUpcoming: true })

        // Recent entry (last release with actual data)
        const prevDate = getPreviousReleaseDate(release, now)
        allEntries.push({ release, date: prevDate, latest, previous, isUpcoming: false })
      }

      setEntries(allEntries)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load calendar data'
      if (msg.toLowerCase().includes('not configured') || msg.toLowerCase().includes('configure')) {
        setError('fred_not_configured')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (error === 'fred_not_configured') return <FREDNotConfigured />
  if (loading) return <LoadingSkeleton label="Loading economic calendar..." />
  if (error) return <ErrorState message={error} onRetry={loadData} />

  const now = new Date()
  const filtered = entries
    .filter(e => (tab === 'upcoming' ? e.isUpcoming : !e.isUpcoming))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  return (
    <div className="w-full h-full flex flex-col bg-[var(--bg-dark)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
        <span className="text-xs font-semibold text-[var(--text-primary)] tracking-wide uppercase">
          Economic Calendar
        </span>
        <div className="flex rounded-md overflow-hidden border border-[var(--border)]">
          <button
            onClick={() => setTab('upcoming')}
            className={`px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
              tab === 'upcoming'
                ? 'bg-white/10 text-[var(--text-primary)]'
                : 'bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setTab('recent')}
            className={`px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
              tab === 'recent'
                ? 'bg-white/10 text-[var(--text-primary)]'
                : 'bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            Recent
          </button>
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[80px_1fr_60px_60px_36px] gap-1 px-3 py-1.5 border-b border-[var(--border)] text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
        <span>Date</span>
        <span>Release</span>
        <span className="text-right">Latest</span>
        <span className="text-right">Prev</span>
        <span className="text-center">Imp</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-[var(--text-tertiary)]">
            No entries
          </div>
        ) : (
          filtered.map((entry, i) => {
            const diffMs = entry.date.getTime() - now.getTime()
            const diffHours = diffMs / (1000 * 60 * 60)
            const isImminent = entry.isUpcoming && diffHours > 0 && diffHours <= 48

            return (
              <div
                key={`${entry.release.series_id}-${entry.isUpcoming ? 'up' : 're'}-${i}`}
                className={`grid grid-cols-[80px_1fr_60px_60px_36px] gap-1 px-3 py-1.5 items-center border-b border-[var(--border)]/30 text-xs transition-colors hover:bg-white/[0.02] ${
                  isImminent ? 'bg-[#FF9100]/5 border-l-2 border-l-[#FF9100]/50' : ''
                }`}
              >
                {/* Date */}
                <span className={`text-[11px] ${isImminent ? 'text-[#FF9100] font-medium' : 'text-[var(--text-secondary)]'}`}>
                  {formatDate(entry.date, now)}
                </span>

                {/* Release name + affects */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[var(--text-primary)] truncate text-[11px]">
                    {entry.release.name}
                  </span>
                  <div className="flex gap-0.5 flex-shrink-0">
                    {entry.release.affects.slice(0, 3).map(a => (
                      <span
                        key={a}
                        className="px-1 py-0 rounded text-[8px] font-medium"
                        style={{
                          color: AFFECT_COLORS[a] || '#888',
                          backgroundColor: `${AFFECT_COLORS[a] || '#888'}15`,
                        }}
                      >
                        {a.slice(0, 2).toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Latest value */}
                <span className="text-right text-[11px] text-[var(--text-primary)] font-mono">
                  {entry.isUpcoming ? '\u2014' : formatValue(entry.release.series_id, entry.latest)}
                </span>

                {/* Previous value */}
                <span className="text-right text-[11px] text-[var(--text-secondary)] font-mono">
                  {formatValue(entry.release.series_id, entry.previous)}
                </span>

                {/* Impact */}
                <span className="text-center text-[11px]" title={entry.release.impact}>
                  {IMPACT_DOTS[entry.release.impact]}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-3 py-1 border-t border-[var(--border)] text-[9px] text-[var(--text-tertiary)]">
        {(['high', 'medium', 'low'] as const).map(level => (
          <span key={level} className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: IMPACT_COLORS[level] }} />
            {level}
          </span>
        ))}
      </div>
    </div>
  )
}
