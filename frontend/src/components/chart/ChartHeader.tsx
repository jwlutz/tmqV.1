import { useState, useRef, useEffect } from 'react'
import { IndicatorConfig } from '../../hooks/useIndicators'
import { MarketStats } from '../../api/client'
import { formatNumber, formatPrice } from '../../hooks/useMarketStats'
import { IntervalDropdown } from './IntervalDropdown'
import { IndicatorsDropdown } from './IndicatorsDropdown'
import { TickerDropdown } from './TickerDropdown'

// Common comparison symbols
const COMPARE_SYMBOLS = [
  // Crypto
  { value: 'BTC-USD', label: 'BTC' },
  { value: 'ETH-USD', label: 'ETH' },
  { value: 'SOL-USD', label: 'SOL' },
  // Equities
  { value: 'SPY', label: 'SPY' },
  { value: 'QQQ', label: 'QQQ' },
  { value: 'GLD', label: 'GLD' },
  { value: 'TLT', label: 'TLT' },
  { value: 'DXY', label: 'DXY' },
]

interface CompareDropdownProps {
  value: string | null | undefined
  onChange: (symbol: string | null) => void
  disabled?: boolean
  currentSymbol: string
}

function CompareDropdown({ value, onChange, disabled, currentSymbol }: CompareDropdownProps) {
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

export interface OHLCVData {
  open: number
  high: number
  low: number
  close: number
  volume?: number
  time?: number
}

interface ChartHeaderProps {
  symbol: string
  onSymbolChange: (symbol: string) => void
  interval: string
  onIntervalChange: (interval: string) => void
  indicators: IndicatorConfig[]
  selectedIndicatorIds: string[]
  onIndicatorToggle: (id: string) => void
  ohlcv: OHLCVData | null
  marketStats: MarketStats | null
  marketStatsLoading?: boolean
  disabled?: boolean
  hideSymbol?: boolean
  hideIndicators?: boolean
  compareSymbol?: string | null
  onCompareSymbolChange?: (symbol: string | null) => void
}

export function ChartHeader({
  symbol,
  onSymbolChange,
  interval,
  onIntervalChange,
  indicators,
  selectedIndicatorIds,
  onIndicatorToggle,
  ohlcv,
  marketStats,
  marketStatsLoading,
  disabled,
  hideSymbol,
  hideIndicators,
  compareSymbol,
  onCompareSymbolChange,
}: ChartHeaderProps) {
  // Use live OHLCV close for real-time price (from WebSocket), fallback to market stats
  const currentPrice = ohlcv?.close ?? marketStats?.price
  // 24h change from CoinGecko market stats
  const change24h = marketStats?.change24h ?? 0
  const changePercent = marketStats?.changePercent24h ?? 0
  const isPositive = change24h >= 0

  return (
    <div className="flex items-center justify-between gap-3 px-2 py-1.5 bg-[var(--bg-darker)] border-b border-[var(--border)] flex-wrap">
      {/* Left: Dropdowns + Price */}
      <div className="flex items-center gap-2">
        {!hideSymbol && (
          <TickerDropdown
            value={symbol}
            onChange={onSymbolChange}
            disabled={disabled}
          />
        )}
        <IntervalDropdown
          value={interval}
          onChange={onIntervalChange}
          disabled={disabled}
        />
        {!hideIndicators && (
          <IndicatorsDropdown
            indicators={indicators}
            selectedIds={selectedIndicatorIds}
            onToggle={onIndicatorToggle}
            disabled={disabled}
          />
        )}

        {/* Compare Symbol */}
        {onCompareSymbolChange && (
          <CompareDropdown
            value={compareSymbol}
            onChange={onCompareSymbolChange}
            disabled={disabled}
            currentSymbol={symbol}
          />
        )}

        {/* Price + Change */}
        {currentPrice !== undefined && (
          <div className="flex items-baseline gap-1.5 ml-2 pl-2 border-l border-[var(--border)]">
            <span className="text-base font-semibold text-[var(--text-primary)] font-mono">
              {formatPrice(currentPrice)}
            </span>
            {marketStats && (
              <span className={`text-xs font-mono ${isPositive ? 'text-[var(--green-up)]' : 'text-[var(--red-down)]'}`}>
                {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right: OHLCV + Market Stats */}
      <div className="flex items-center gap-3 text-xs font-mono">
        {/* OHLCV */}
        {ohlcv && (
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--text-tertiary)]">O</span>
            <span className="text-[var(--text-primary)]">{formatPrice(ohlcv.open)}</span>
            <span className="text-[var(--text-tertiary)]">H</span>
            <span className="text-[var(--green-up)]">{formatPrice(ohlcv.high)}</span>
            <span className="text-[var(--text-tertiary)]">L</span>
            <span className="text-[var(--red-down)]">{formatPrice(ohlcv.low)}</span>
            <span className="text-[var(--text-tertiary)]">C</span>
            <span className={ohlcv.close >= ohlcv.open ? 'text-[var(--green-up)]' : 'text-[var(--red-down)]'}>
              {formatPrice(ohlcv.close)}
            </span>
            {ohlcv.volume !== undefined && (
              <>
                <span className="text-[var(--text-tertiary)]">V</span>
                <span className="text-[var(--text-secondary)]">{formatNumber(ohlcv.volume)}</span>
              </>
            )}
          </div>
        )}

        {/* Market Stats */}
        {marketStats && !marketStatsLoading && (
          <div className="flex items-center gap-2 pl-2 border-l border-[var(--border)]">
            <span className="text-[var(--text-tertiary)]">Mkt Cap:</span>
            <span className="text-[var(--text-secondary)]">{formatNumber(marketStats.marketCap)}</span>
            <span className="text-[var(--text-tertiary)]">24h Vol:</span>
            <span className="text-[var(--text-secondary)]">{formatNumber(marketStats.volume24h)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
