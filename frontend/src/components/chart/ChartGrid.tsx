import { useChartLayout, useInterval } from '../../context'
import { ChartPane } from './ChartPane'
import { ChartHeader } from './ChartHeader'
import { LayoutSelector } from './LayoutSelector'

export function ChartGrid() {
  const { layout, setLayout, panes, activePaneId, setActivePaneId, setPaneSymbol } = useChartLayout()
  const { interval, setInterval } = useInterval()

  const gridClass =
    layout === '1x1' ? 'grid-cols-1 grid-rows-1' :
    layout === '1x2' ? 'grid-cols-2 grid-rows-1' :
    'grid-cols-2 grid-rows-2'

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Shared toolbar */}
      <div className="flex items-center justify-between gap-2 px-2 py-1 bg-[var(--bg-darker)] border-b border-[var(--border)]">
        <ChartHeader
          symbol={panes.find(p => p.id === activePaneId)?.symbol || 'BTC-USD'}
          onSymbolChange={(s) => setPaneSymbol(activePaneId, s)}
          interval={interval}
          onIntervalChange={setInterval}
          indicators={[]}
          selectedIndicatorIds={[]}
          onIndicatorToggle={() => {}}
          ohlcv={null}
          marketStats={null}
          hideSymbol
          hideIndicators
        />
        <LayoutSelector value={layout} onChange={setLayout} />
      </div>

      {/* Chart grid */}
      <div className={`grid ${gridClass} gap-1 flex-1 min-h-0 p-1`}>
        {panes.map(pane => (
          <ChartPane
            key={pane.id}
            paneId={pane.id}
            symbol={pane.symbol}
            interval={interval}
            isActive={pane.id === activePaneId}
            onActivate={() => setActivePaneId(pane.id)}
            onSymbolChange={(s) => setPaneSymbol(pane.id, s)}
          />
        ))}
      </div>
    </div>
  )
}
