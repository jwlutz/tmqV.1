import { useChartLayout, useAppContext } from '../../context'
import type { MacroOverlay } from '../../context'
import { ChartPane } from './ChartPane'
import { LayoutSelector } from './LayoutSelector'

export function ChartGrid() {
  const { layout, setLayout, panes, activePaneId, setActivePaneId, setPaneSymbol, setPaneInterval } = useChartLayout()
  const { addMacroOverlay, removeMacroOverlay } = useAppContext()

  const gridClass =
    layout === '1x1' ? 'grid-cols-1 grid-rows-1' :
    layout === '1x2' ? 'grid-cols-2 grid-rows-1' :
    'grid-cols-2 grid-rows-2'

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Layout selector toolbar — only shown for multi-pane layouts */}
      {layout !== '1x1' && (
        <div className="flex items-center justify-end px-2 py-1 bg-[var(--bg-darker)] border-b border-[var(--border)]">
          <LayoutSelector value={layout} onChange={setLayout} />
        </div>
      )}

      {/* Chart grid */}
      <div className={`grid ${gridClass} gap-1 flex-1 min-h-0 p-1`}>
        {panes.map(pane => (
          <ChartPane
            key={pane.id}
            paneId={pane.id}
            symbol={pane.symbol}
            interval={pane.interval}
            isActive={pane.id === activePaneId}
            onActivate={() => setActivePaneId(pane.id)}
            onSymbolChange={(s) => setPaneSymbol(pane.id, s)}
            onIntervalChange={(i) => setPaneInterval(pane.id, i)}
            showLayoutSelector={layout === '1x1'}
            layoutValue={layout}
            onLayoutChange={setLayout}
            macroOverlays={pane.macroOverlays}
            onAddMacroOverlay={(overlay: MacroOverlay) => addMacroOverlay(pane.id, overlay)}
            onRemoveMacroOverlay={(overlayId: string) => removeMacroOverlay(pane.id, overlayId)}
          />
        ))}
      </div>
    </div>
  )
}
