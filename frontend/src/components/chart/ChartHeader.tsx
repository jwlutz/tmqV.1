import { IndicatorConfig } from '../../hooks/useIndicators'
import { MarketStats } from '../../api/client'
import { formatNumber, formatPrice } from '../../hooks/useMarketStats'
import { IntervalDropdown } from './IntervalDropdown'
import { IndicatorsDropdown } from './IndicatorsDropdown'
import { TickerDropdown } from './TickerDropdown'

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
