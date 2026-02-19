import { useState, useCallback, useEffect, useRef } from 'react'
import { ChartPane } from '../chart/ChartPane'
import type { WidgetType, ChartLayout } from '../../context'

// Chart tab state for AI context awareness
export interface ChartTabState {
  symbol: string
  interval: string
  widgetType: WidgetType
}

// Extend window for AI-controlled chart state
declare global {
  interface Window {
    __chartSetSymbol?: Map<string, (symbol: string) => void>;
    __chartSetWidgetType?: Map<string, (widgetType: WidgetType) => void>;
    __chartSetInterval?: Map<string, (interval: string) => void>;
    __chartGetState?: Map<string, () => ChartTabState>;
    __activeChartTabId?: string;
  }
}

interface ChartTabContentProps {
  tabId: string
}

const DEFAULT_STATE: ChartTabState = {
  symbol: 'BTC-USD',
  interval: '1d',
  widgetType: 'candlestick',
}

function getStorageKey(tabId: string) {
  return `chart-tab-${tabId}`
}

function loadTabState(tabId: string): ChartTabState {
  try {
    const saved = localStorage.getItem(getStorageKey(tabId))
    if (saved) {
      return { ...DEFAULT_STATE, ...JSON.parse(saved) }
    }
  } catch (e) {
    console.warn('Failed to load chart tab state:', e)
  }
  return DEFAULT_STATE
}

function saveTabState(tabId: string, state: ChartTabState) {
  try {
    localStorage.setItem(getStorageKey(tabId), JSON.stringify(state))
  } catch (e) {
    console.warn('Failed to save chart tab state:', e)
  }
}

export function ChartTabContent({ tabId }: ChartTabContentProps) {
  const [state, setState] = useState<ChartTabState>(() => loadTabState(tabId))

  // Ref to track current state for getter (avoids stale closure)
  const stateRef = useRef(state)
  stateRef.current = state

  // Save state when it changes
  useEffect(() => {
    saveTabState(tabId, state)
  }, [tabId, state])

  const handleSymbolChange = useCallback((symbol: string) => {
    setState(prev => ({ ...prev, symbol }))
  }, [])

  const handleIntervalChange = useCallback((interval: string) => {
    setState(prev => ({ ...prev, interval }))
  }, [])

  const handleWidgetTypeChange = useCallback((widgetType: WidgetType) => {
    setState(prev => ({ ...prev, widgetType }))
  }, [])

  // Stub handlers for layout (not used in single-chart mode)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleLayoutChange = useCallback((_layout: ChartLayout) => {}, [])

  // Register setters and getter on window for AI control and context awareness
  useEffect(() => {
    // Initialize maps if needed
    if (!window.__chartSetSymbol) window.__chartSetSymbol = new Map();
    if (!window.__chartSetWidgetType) window.__chartSetWidgetType = new Map();
    if (!window.__chartSetInterval) window.__chartSetInterval = new Map();
    if (!window.__chartGetState) window.__chartGetState = new Map();

    // Register this tab's setters
    window.__chartSetSymbol.set(tabId, handleSymbolChange);
    window.__chartSetWidgetType.set(tabId, handleWidgetTypeChange);
    window.__chartSetInterval.set(tabId, handleIntervalChange);

    // Register state getter for AI context awareness (uses ref to get latest state)
    window.__chartGetState.set(tabId, () => stateRef.current);

    // Track this as active chart tab (most recently mounted/focused)
    window.__activeChartTabId = tabId;

    return () => {
      // Cleanup on unmount
      window.__chartSetSymbol?.delete(tabId);
      window.__chartSetWidgetType?.delete(tabId);
      window.__chartSetInterval?.delete(tabId);
      window.__chartGetState?.delete(tabId);
      if (window.__activeChartTabId === tabId) {
        window.__activeChartTabId = undefined;
      }
    };
  }, [tabId, handleSymbolChange, handleWidgetTypeChange, handleIntervalChange])

  return (
    <div className="h-full w-full">
      <ChartPane
        paneId={tabId}
        symbol={state.symbol}
        interval={state.interval}
        isActive={true}
        onActivate={() => {}}
        onSymbolChange={handleSymbolChange}
        onIntervalChange={handleIntervalChange}
        showLayoutSelector={false}
        layoutValue="1x1"
        onLayoutChange={handleLayoutChange}
        widgetType={state.widgetType}
        onWidgetTypeChange={handleWidgetTypeChange}
      />
    </div>
  )
}
