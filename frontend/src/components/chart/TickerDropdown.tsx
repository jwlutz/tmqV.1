import { useState, useEffect, useRef, useMemo } from 'react'

interface TickerDropdownProps {
  value: string
  onChange: (symbol: string) => void
  disabled?: boolean
}

const COMMON_SYMBOLS = {
  crypto: [
    'BTC-USD', 'ETH-USD', 'SOL-USD', 'DOGE-USD', 'ADA-USD',
    'XRP-USD', 'AVAX-USD', 'DOT-USD', 'LINK-USD', 'MATIC-USD',
    'BTC/USDT', 'ETH/USDT', 'SOL/USDT',
  ],
  equities: [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK-B',
    'JPM', 'V', 'JNJ', 'WMT', 'PG', 'MA', 'HD', 'DIS', 'BAC', 'XOM',
    'KO', 'PEP', 'COST', 'ABBV', 'MRK', 'TMO', 'CSCO', 'ACN', 'MCD',
    'NKE', 'INTC', 'AMD', 'CRM', 'NFLX', 'QCOM', 'TXN', 'AMAT',
    'SPY', 'QQQ', 'IWM', 'DIA', 'VOO', 'VTI', 'ARKK',
    'GLD', 'SLV', 'GC=F', 'SI=F', 'CL=F',
  ],
}

export function TickerDropdown({ value, onChange, disabled }: TickerDropdownProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
    if (open) {
      setSearch('')
      inputRef.current?.focus()
    }
  }, [open])

  const query = search.toLowerCase()

  const filteredCrypto = useMemo(
    () => COMMON_SYMBOLS.crypto.filter(s => s.toLowerCase().includes(query)),
    [query]
  )

  const filteredEquities = useMemo(
    () => COMMON_SYMBOLS.equities.filter(s => s.toLowerCase().includes(query)),
    [query]
  )

  const hasResults = filteredCrypto.length > 0 || filteredEquities.length > 0

  function handleSelect(symbol: string) {
    onChange(symbol)
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && search.trim()) {
      handleSelect(search.trim().toUpperCase())
    }
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => { if (!disabled) setOpen(!open) }}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm font-mono font-semibold
          bg-[var(--bg-darker)] border border-[var(--border)]
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--text-secondary)] cursor-pointer'}
          text-[var(--text-primary)] transition-colors`}
      >
        {value}
        <svg className="w-3 h-3 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-[#0d1119] border border-[rgba(255,255,255,0.1)] rounded shadow-[0_4px_20px_rgba(0,0,0,0.5)] z-50 overflow-hidden">
          <div className="p-2 border-b border-[var(--border)]">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search or type symbol..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-2 py-1 bg-[var(--bg-dark)] border border-[var(--border)] rounded text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--text-secondary)]"
            />
            {search.trim() && (
              <p className="text-[10px] text-[var(--text-tertiary)] mt-1 px-0.5">
                Press Enter to load "{search.trim().toUpperCase()}"
              </p>
            )}
          </div>
          <div className="max-h-60 overflow-y-auto">
            {/* Crypto section */}
            {filteredCrypto.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider bg-[rgba(255,255,255,0.02)]">
                  Crypto
                </div>
                {filteredCrypto.map(s => (
                  <button
                    key={s}
                    onClick={() => handleSelect(s)}
                    className={`w-full text-left px-3 py-1.5 text-sm font-mono hover:bg-[var(--bg-medium)] transition-colors ${
                      s === value ? 'text-[var(--green-up)]' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </>
            )}

            {/* Equities section */}
            {filteredEquities.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider bg-[rgba(255,255,255,0.02)]">
                  Equities / ETFs
                </div>
                {filteredEquities.map(s => (
                  <button
                    key={s}
                    onClick={() => handleSelect(s)}
                    className={`w-full text-left px-3 py-1.5 text-sm font-mono hover:bg-[var(--bg-medium)] transition-colors ${
                      s === value ? 'text-[var(--green-up)]' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </>
            )}

            {!hasResults && !search.trim() && (
              <p className="px-3 py-2 text-sm text-[var(--text-tertiary)]">Start typing to search...</p>
            )}
            {!hasResults && search.trim() && (
              <p className="px-3 py-2 text-sm text-[var(--text-tertiary)]">
                No matches. Press Enter to try "{search.trim().toUpperCase()}"
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
