import { useState, useRef, useEffect } from 'react'
import { fetchMacroSeries, searchMacroSeries, MacroSeriesInfo } from '../../api/client'
import { useFredSettings } from '../../context'
import type { MacroOverlay } from '../../context'

// Curated popular series (matches backend POPULAR_SERIES)
const POPULAR_SERIES: MacroSeriesInfo[] = [
  { id: 'FEDFUNDS', name: 'Federal Funds Rate', category: 'rates', frequency: 'monthly' },
  { id: 'DGS10', name: '10-Year Treasury Yield', category: 'rates', frequency: 'daily' },
  { id: 'DGS2', name: '2-Year Treasury Yield', category: 'rates', frequency: 'daily' },
  { id: 'T10Y2Y', name: '10Y-2Y Yield Spread', category: 'rates', frequency: 'daily' },
  { id: 'T10YIE', name: '10Y Breakeven Inflation', category: 'inflation', frequency: 'daily' },
  { id: 'CPIAUCSL', name: 'CPI', category: 'inflation', frequency: 'monthly' },
  { id: 'PCEPI', name: 'PCE Price Index', category: 'inflation', frequency: 'monthly' },
  { id: 'UNRATE', name: 'Unemployment Rate', category: 'employment', frequency: 'monthly' },
  { id: 'PAYEMS', name: 'Nonfarm Payrolls', category: 'employment', frequency: 'monthly' },
  { id: 'ICSA', name: 'Initial Jobless Claims', category: 'employment', frequency: 'weekly' },
  { id: 'GDP', name: 'GDP', category: 'output', frequency: 'quarterly' },
  { id: 'VIXCLS', name: 'VIX', category: 'volatility', frequency: 'daily' },
  { id: 'DEXUSEU', name: 'EUR/USD', category: 'fx', frequency: 'daily' },
  { id: 'DTWEXBGS', name: 'US Dollar Index', category: 'fx', frequency: 'daily' },
  { id: 'M2SL', name: 'M2 Money Supply', category: 'money', frequency: 'monthly' },
  { id: 'WALCL', name: 'Fed Balance Sheet', category: 'money', frequency: 'weekly' },
  { id: 'MORTGAGE30US', name: '30Y Mortgage Rate', category: 'rates', frequency: 'weekly' },
  { id: 'BAMLH0A0HYM2', name: 'HY Credit Spread', category: 'credit', frequency: 'daily' },
  { id: 'DCOILWTICO', name: 'WTI Crude Oil', category: 'commodities', frequency: 'daily' },
  { id: 'GOLDAMGBD228NLBM', name: 'Gold Price', category: 'commodities', frequency: 'daily' },
]

// Distinct macro colors (gold/warm palette to distinguish from indicator blues/greens)
const MACRO_COLORS = [
  '#FFD700', '#FF8C00', '#FF6347', '#DA70D6', '#00CED1',
  '#FFB347', '#FF69B4', '#7FFF00', '#40E0D0', '#DDA0DD',
]

interface MacroDropdownProps {
  paneId: string
  activeOverlays: MacroOverlay[]
  onAddOverlay: (overlay: MacroOverlay) => void
  onRemoveOverlay: (overlayId: string) => void
  disabled?: boolean
  startDate?: string
  endDate?: string
}

export function MacroDropdown({ activeOverlays, onAddOverlay, onRemoveOverlay, disabled, startDate, endDate }: MacroDropdownProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ id: string; title: string }>>([])
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { fredConfigured } = useFredSettings()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || !fredConfigured) {
      setSearchResults([])
      return
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await searchMacroSeries(searchQuery)
        setSearchResults(results.slice(0, 10))
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current) }
  }, [searchQuery, fredConfigured])

  const activeIds = new Set(activeOverlays.map(o => o.seriesId))

  const handleToggle = async (seriesId: string, name: string) => {
    // If already active, remove it
    const existing = activeOverlays.find(o => o.seriesId === seriesId)
    if (existing) {
      onRemoveOverlay(existing.id)
      return
    }

    if (!fredConfigured) return

    // Fetch and add
    setLoading(seriesId)
    try {
      const result = await fetchMacroSeries(seriesId, startDate, endDate)
      const colorIdx = activeOverlays.length % MACRO_COLORS.length
      const overlay: MacroOverlay = {
        id: `macro-${seriesId}-${Date.now()}`,
        seriesId,
        name,
        data: result.data,
        color: MACRO_COLORS[colorIdx],
      }
      onAddOverlay(overlay)
    } catch (err) {
      console.warn('Failed to fetch macro series:', err)
    } finally {
      setLoading(null)
    }
  }

  // Group popular series by category
  const categories = [...new Set(POPULAR_SERIES.map(s => s.category))]

  const selectedCount = activeOverlays.length

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm
          bg-[var(--bg-darker)] border border-[var(--border)]
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--text-secondary)] cursor-pointer'}
          text-[var(--text-primary)] transition-colors`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        Macro
        {selectedCount > 0 && (
          <span className="px-1.5 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-400">
            {selectedCount}
          </span>
        )}
        <svg className="w-3 h-3 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-[#0d1119] border border-[rgba(255,255,255,0.1)] rounded shadow-[0_4px_20px_rgba(0,0,0,0.5)] z-50 max-h-80 overflow-y-auto">
          {!fredConfigured ? (
            <div className="p-3 text-center">
              <p className="text-xs text-[var(--text-tertiary)] mb-2">FRED API key required</p>
              <p className="text-xs text-[var(--text-tertiary)]">
                Configure in Settings
              </p>
              <a
                href="https://fred.stlouisfed.org/docs/api/api_key.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-amber-400 hover:text-amber-300 mt-1 inline-block"
              >
                Get free key
              </a>
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="p-2 border-b border-[var(--border)]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search FRED..."
                  className="w-full px-2 py-1 bg-[var(--bg-medium)] border border-[var(--border)]
                             rounded text-xs text-[var(--text-primary)] font-mono
                             placeholder:text-[var(--text-tertiary)] outline-none
                             focus:border-[var(--text-secondary)]"
                />
              </div>

              {/* Search results */}
              {searchQuery.trim() && (
                <div className="border-b border-[var(--border)]">
                  {searching ? (
                    <div className="p-2 text-xs text-[var(--text-tertiary)]">Searching...</div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map(r => (
                      <button
                        key={r.id}
                        onClick={() => handleToggle(r.id, r.title)}
                        disabled={loading === r.id}
                        className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--bg-dark)] transition-colors"
                      >
                        <span className={`w-3 h-3 rounded border flex items-center justify-center
                          ${activeIds.has(r.id)
                            ? 'border-amber-400 bg-amber-400'
                            : 'border-[var(--border)]'}`}
                        >
                          {activeIds.has(r.id) && (
                            <svg className="w-2 h-2 text-[var(--bg-darkest)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span className="text-[var(--text-secondary)] truncate">
                          <span className="text-amber-400 font-mono">{r.id}</span>{' '}
                          {r.title}
                        </span>
                        {loading === r.id && <span className="text-[var(--text-tertiary)] ml-auto">...</span>}
                      </button>
                    ))
                  ) : (
                    <div className="p-2 text-xs text-[var(--text-tertiary)]">No results</div>
                  )}
                </div>
              )}

              {/* Popular series grouped by category */}
              {!searchQuery.trim() && categories.map(cat => (
                <div key={cat}>
                  <div className="px-3 py-1 border-b border-[var(--border)]">
                    <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">{cat}</span>
                  </div>
                  {POPULAR_SERIES.filter(s => s.category === cat).map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleToggle(s.id, s.name)}
                      disabled={loading === s.id}
                      className="flex items-center gap-2 w-full text-left px-3 py-1 text-xs hover:bg-[var(--bg-dark)] transition-colors"
                    >
                      <span className={`w-3 h-3 rounded border flex items-center justify-center
                        ${activeIds.has(s.id)
                          ? 'border-amber-400 bg-amber-400'
                          : 'border-[var(--border)]'}`}
                      >
                        {activeIds.has(s.id) && (
                          <svg className="w-2 h-2 text-[var(--bg-darkest)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className={activeIds.has(s.id) ? 'text-amber-400' : 'text-[var(--text-secondary)]'}>
                        <span className="font-mono">{s.id}</span>{' '}
                        <span className="text-[var(--text-tertiary)]">{s.name}</span>
                      </span>
                      {loading === s.id && <span className="text-[var(--text-tertiary)] ml-auto">...</span>}
                    </button>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
