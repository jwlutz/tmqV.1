import { useState, useRef, useEffect } from 'react'

// Common comparison symbols
const COMPARE_SYMBOLS = [
  // Crypto
  { value: 'BTC-USD', label: 'BTC' },
  { value: 'ETH-USD', label: 'ETH' },
  { value: 'SOL-USD', label: 'SOL' },
  // Equities & ETFs
  { value: 'SPY', label: 'SPY' },
  { value: 'QQQ', label: 'QQQ' },
  { value: 'GLD', label: 'GLD' },
  { value: 'TLT', label: 'TLT' },
  { value: 'DX-Y.NYB', label: 'DXY' },  // Dollar Index (yfinance symbol)
]

interface CompareDropdownProps {
  value: string | null | undefined
  onChange: (symbol: string | null) => void
  disabled?: boolean
  currentSymbol: string
}

export function CompareDropdown({ value, onChange, disabled, currentSymbol }: CompareDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [customSymbol, setCustomSymbol] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter out current symbol from options
  const availableSymbols = COMPARE_SYMBOLS.filter(s => s.value !== currentSymbol)

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (customSymbol.trim()) {
      onChange(customSymbol.trim().toUpperCase())
      setCustomSymbol('')
      setIsOpen(false)
    }
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm
          bg-[var(--bg-darker)] border border-[var(--border)]
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--text-secondary)] cursor-pointer'}
          text-[var(--text-primary)] transition-colors`}
      >
        {/* Compare icon - two overlapping lines */}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
        Compare
        {value && (
          <span className="px-1.5 py-0.5 text-xs rounded-full bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]">
            {value}
          </span>
        )}
        {value && (
          <button
            onClick={(e) => { e.stopPropagation(); onChange(null) }}
            className="ml-0.5 hover:text-[var(--red-down)]"
          >
            ×
          </button>
        )}
        <svg className="w-3 h-3 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-[var(--bg-card)] border border-[var(--border)] rounded shadow-lg z-50">
          {/* Quick picks */}
          <div className="p-1 border-b border-[var(--border)]">
            <div className="text-[10px] text-[var(--text-tertiary)] px-2 py-1">Quick picks</div>
            <div className="grid grid-cols-4 gap-1">
              {availableSymbols.map(s => (
                <button
                  key={s.value}
                  onClick={() => { onChange(s.value); setIsOpen(false) }}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    value === s.value
                      ? 'bg-[var(--accent-blue)] text-white'
                      : 'bg-[var(--bg-darker)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom symbol input */}
          <form onSubmit={handleCustomSubmit} className="p-2">
            <div className="text-[10px] text-[var(--text-tertiary)] mb-1">Custom symbol</div>
            <div className="flex gap-1">
              <input
                type="text"
                value={customSymbol}
                onChange={(e) => setCustomSymbol(e.target.value)}
                placeholder="AAPL, GLD..."
                className="flex-1 px-2 py-1 text-xs bg-[var(--bg-darker)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-blue)]"
              />
              <button
                type="submit"
                className="px-2 py-1 text-xs bg-[var(--accent-blue)] text-white rounded hover:bg-[var(--accent-blue)]/80"
              >
                Add
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
