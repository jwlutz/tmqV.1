import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { IndicatorsDropdown } from './IndicatorsDropdown'
import { PaneIntervalSelector } from './PaneIntervalSelector'
import { TickerDropdown } from './TickerDropdown'
import { LayoutSelector } from './LayoutSelector'
import { CompareDropdown } from './CompareDropdown'
import { getWidgetComponent, WIDGET_REGISTRY } from '../../widgets'
import type { WidgetType, WidgetDefinition } from '../../widgets'
import type { ChartLayout } from '../../context'
import type { CandlestickIndicatorInfo } from '../../widgets/CandlestickWidget'

interface ChartPaneProps {
  paneId: string;
  symbol: string;
  interval: string;
  isActive: boolean;
  onActivate: () => void;
  onSymbolChange: (symbol: string) => void;
  onIntervalChange: (interval: string) => void;
  showLayoutSelector?: boolean;
  layoutValue?: ChartLayout;
  onLayoutChange?: (layout: ChartLayout) => void;
  widgetType: WidgetType;
  onWidgetTypeChange: (type: WidgetType) => void;
}

// Group widget types by category for dropdown
const WIDGET_CATEGORIES = ['Charts', 'Macro', 'Fundamentals', 'Sentiment'] as const
function getGroupedWidgets() {
  const groups: Record<string, WidgetDefinition[]> = {}
  for (const cat of WIDGET_CATEGORIES) groups[cat] = []
  for (const def of Object.values(WIDGET_REGISTRY)) {
    groups[def.category]?.push(def)
  }
  return groups
}
const GROUPED_WIDGETS = getGroupedWidgets()

export function ChartPane({
  paneId, symbol, interval, isActive, onActivate,
  onSymbolChange, onIntervalChange,
  showLayoutSelector, layoutValue, onLayoutChange,
  widgetType, onWidgetTypeChange,
}: ChartPaneProps) {
  const definition = WIDGET_REGISTRY[widgetType]
  const [widgetMenuOpen, setWidgetMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // State bubbled up from CandlestickWidget via callbacks
  const [chartStatus, setChartStatus] = useState('connecting')
  const [compareSymbol, setCompareSymbol] = useState<string | null>(null)

  // Store indicator info in a ref to avoid infinite re-render loops.
  const indicatorInfoRef = useRef<CandlestickIndicatorInfo | null>(null)
  const [indicatorVersion, setIndicatorVersion] = useState(0)
  const prevSelectedIdsKey = useRef('')

  const handleIndicatorsReady = useCallback((info: CandlestickIndicatorInfo) => {
    indicatorInfoRef.current = info
    const key = info.selectedIds.join(',') + '|' + String(info.showVolume)
    if (key !== prevSelectedIdsKey.current) {
      prevSelectedIdsKey.current = key
      setIndicatorVersion(v => v + 1)
    }
  }, [])

  // Read the ref — the version counter ensures this re-evaluates when needed
  void indicatorVersion
  const indicatorInfo = indicatorInfoRef.current

  // Close widget menu on outside click
  useEffect(() => {
    if (!widgetMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setWidgetMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [widgetMenuOpen])

  const handleWidgetSelect = useCallback((type: WidgetType) => {
    onWidgetTypeChange(type)
    setWidgetMenuOpen(false)
    indicatorInfoRef.current = null
    prevSelectedIdsKey.current = ''
    setIndicatorVersion(v => v + 1)
    setCompareSymbol(null)
    setChartStatus('connecting')
  }, [onWidgetTypeChange])

  const isCandlestick = widgetType === 'candlestick'
  const controlsDisabled = isCandlestick && chartStatus !== 'connected' && chartStatus !== 'error'

  const WidgetComponent = getWidgetComponent(widgetType)

  return (
    <div
      className={`flex flex-col w-full h-full rounded-lg overflow-hidden border transition-colors ${
        isActive
          ? 'border-[var(--green-up)]/50'
          : 'border-[var(--border)] hover:border-[rgba(255,255,255,0.12)]'
      }`}
      onClick={onActivate}
    >
      {/* Pane header */}
      <div className="flex items-center justify-between gap-2 px-2 py-1 bg-[var(--bg-darker)] border-b border-[var(--border)] min-h-[28px]">
        <div className="flex items-center gap-2 min-w-0">
          {/* Widget type selector */}
          <div className="relative" ref={menuRef} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setWidgetMenuOpen(v => !v)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-white/5 hover:bg-white/10 transition-colors text-[var(--text-secondary)]"
              title={definition.label}
            >
              <span>{definition.icon}</span>
              <svg className="w-2.5 h-2.5 opacity-50" fill="none" viewBox="0 0 10 6"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>

            {widgetMenuOpen && (
              <div className="absolute top-full left-0 mt-1 w-52 rounded-lg bg-[#1a1f2e] border border-[var(--border)] shadow-xl z-50 py-1 max-h-80 overflow-y-auto">
                {WIDGET_CATEGORIES.map(cat => {
                  const items = GROUPED_WIDGETS[cat]
                  if (!items || items.length === 0) return null
                  return (
                    <div key={cat}>
                      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                        {cat}
                      </div>
                      {items.map(def => (
                        <button
                          key={def.type}
                          onClick={() => handleWidgetSelect(def.type)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/5 transition-colors text-left"
                        >
                          <span className="w-5 text-center">{def.icon}</span>
                          <span className="text-[var(--text-primary)] flex-1">{def.label}</span>
                          {def.type === widgetType && (
                            <span className="text-[var(--green-up)]">&#10003;</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Symbol dropdown */}
          {definition.needsSymbol && (
            <div onClick={e => e.stopPropagation()}>
              <TickerDropdown value={symbol} onChange={onSymbolChange} />
            </div>
          )}

          {/* Interval selector */}
          {definition.needsInterval && (
            <PaneIntervalSelector value={interval} onChange={onIntervalChange} />
          )}

          {/* Indicator chips + dropdown */}
          {definition.supportsIndicators && indicatorInfo && (
            <>
              {indicatorInfo.selectedIds.length > 0 && (
                <div className="flex items-center gap-0.5">
                  {indicatorInfo.selectedIds.slice(0, 3).map(id => {
                    const config = indicatorInfo.availableIndicators.find(i => i.id === id)
                    if (!config) return null
                    return (
                      <button
                        key={id}
                        onClick={(e) => { e.stopPropagation(); indicatorInfo.toggleIndicator(id) }}
                        className="flex items-center gap-0.5 px-1 py-0 rounded text-[10px] font-mono bg-white/5 hover:bg-white/10 transition-colors"
                        style={{ color: config.color }}
                        title={`Remove ${config.label}`}
                      >
                        {config.shortLabel}
                        <span className="text-[var(--text-tertiary)]">&times;</span>
                      </button>
                    )
                  })}
                  {indicatorInfo.selectedIds.length > 3 && (
                    <span className="text-[10px] text-[var(--text-tertiary)]">+{indicatorInfo.selectedIds.length - 3}</span>
                  )}
                </div>
              )}
              <IndicatorsDropdown
                indicators={indicatorInfo.availableIndicators}
                categories={indicatorInfo.indicatorCategories}
                selectedIds={indicatorInfo.selectedIds}
                onToggle={indicatorInfo.toggleIndicator}
                showVolume={indicatorInfo.showVolume}
                onToggleVolume={indicatorInfo.toggleVolume}
                customIndicators={indicatorInfo.customIndicators}
                onAddCustom={indicatorInfo.addCustomIndicator}
                onRemoveCustom={indicatorInfo.removeCustomIndicator}
                disabled={controlsDisabled}
              />
            </>
          )}

          {/* Compare dropdown */}
          {isCandlestick && (
            <div onClick={e => e.stopPropagation()}>
              <CompareDropdown
                value={compareSymbol}
                onChange={setCompareSymbol}
                disabled={controlsDisabled}
                currentSymbol={symbol}
              />
            </div>
          )}

        </div>

        <div className="flex items-center gap-1">
          {showLayoutSelector && layoutValue && onLayoutChange && (
            <div onClick={e => e.stopPropagation()}>
              <LayoutSelector value={layoutValue} onChange={onLayoutChange} />
            </div>
          )}
          <span className={`w-1.5 h-1.5 rounded-full ${
            isCandlestick
              ? (chartStatus === 'connected' ? 'bg-[var(--green-up)]' :
                 chartStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                 'bg-[var(--red-down)]')
              : 'bg-[var(--text-tertiary)]'
          }`} />
        </div>
      </div>

      {/* Widget body */}
      <div className="flex flex-col flex-1 min-h-0">
        {isCandlestick ? (
          <WidgetComponent
            paneId={paneId}
            symbol={symbol}
            interval={interval}
            macroOverlays={[]}
            compareSymbol={compareSymbol}
            onCompareSymbolChange={setCompareSymbol}
            onStatusChange={setChartStatus}
            onIndicatorsReady={handleIndicatorsReady}
          />
        ) : (
          <Suspense fallback={<div className="w-full h-full flex items-center justify-center bg-[var(--bg-dark)]"><div className="w-6 h-6 border-2 border-[var(--text-tertiary)] border-t-[var(--text-primary)] rounded-full animate-spin" /></div>}>
            <WidgetComponent
              definition={definition}
              width={0}
              height={0}
            />
          </Suspense>
        )}
      </div>
    </div>
  )
}
