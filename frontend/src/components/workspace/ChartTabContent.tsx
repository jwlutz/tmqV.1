import { useState, useCallback, useEffect } from 'react'
import { ChartPane } from '../chart/ChartPane'
import type { WidgetType, ChartLayout } from '../../context'

interface ChartTabContentProps {
  tabId: string
}

interface ChartTabState {
  symbol: string
  interval: string
  widgetType: WidgetType
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
  const handleLayoutChange = useCallback((_layout: ChartLayout) => {}, [])

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
