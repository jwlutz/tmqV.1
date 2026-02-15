import { useState, useEffect, useRef } from 'react'
import { useSymbol } from '../../context'

export function TickerPicker() {
  const { symbol, setSymbol } = useSymbol()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [symbols, setSymbols] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch symbols once on mount
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/symbols')
      .then(r => r.json())
      .then((data: string[]) => {
        if (!cancelled) setSymbols(data)
      })
      .catch(err => console.error('Failed to fetch symbols:', err))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Focus input when dropdown opens
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Convert ccxt format (BTC/USD) to Coinbase format (BTC-USD)
  function toCoinbase(s: string) {
    return s.replace('/', '-')
  }

  // Convert Coinbase format back for display
  function toDisplay(s: string) {
    return s.replace('-', '/')
  }

  const filtered = symbols.filter(s =>
    s.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => { setOpen(!open); setSearch('') }}
        className="flex items-center gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-md bg-[var(--bg-darker)] border border-[var(--border)] text-sm font-mono text-[var(--text-primary)] hover:border-[var(--text-secondary)] transition-colors"
      >
        {toDisplay(symbol)}
        <svg className="w-3 h-3 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-[var(--bg-darker)] border border-[var(--border)] rounded-md shadow-lg z-50 overflow-hidden">
          <div className="p-2 border-b border-[var(--border)]">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search symbols..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-2 py-1 bg-[var(--bg-dark)] border border-[var(--border)] rounded text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--text-secondary)]"
            />
          </div>
          <ul className="max-h-60 overflow-y-auto">
            {loading && (
              <li className="px-3 py-2 text-sm text-[var(--text-secondary)]">Loading...</li>
            )}
            {!loading && filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-[var(--text-secondary)]">No results</li>
            )}
            {filtered.map(s => (
              <li key={s}>
                <button
                  onClick={() => {
                    setSymbol(toCoinbase(s))
                    setOpen(false)
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm font-mono hover:bg-[var(--bg-dark)] transition-colors ${
                    toCoinbase(s) === symbol
                      ? 'text-[var(--green-up)]'
                      : 'text-[var(--text-primary)]'
                  }`}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
