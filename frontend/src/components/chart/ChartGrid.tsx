import { useState, useRef, useEffect, type CSSProperties, useCallback } from 'react'
import { useChartLayout } from '../../context'
import { ChartPane } from './ChartPane'
import { LayoutSelector } from './LayoutSelector'
import { LAYOUT_PRESETS } from '../../widgets/presets'
import { ResizeHandle } from './ResizeHandle'
import { useLocalStorage } from '../../hooks/useLocalStorage'

export function ChartGrid() {
  const { layout, setLayout, panes, activePaneId, setActivePaneId, setPaneSymbol, setPaneInterval, setWidgetType, applyLayoutPreset } = useChartLayout()

  const [presetsOpen, setPresetsOpen] = useState(false)
  const presetsRef = useRef<HTMLDivElement>(null)
  const gridWrapperRef = useRef<HTMLDivElement>(null)

  const [colRatio, setColRatio] = useLocalStorage('gridColRatio', 0.5)
  const [rowRatio, setRowRatio] = useLocalStorage('gridRowRatio', 0.5)

  // Reset ratios when layout changes
  useEffect(() => { setColRatio(0.5); setRowRatio(0.5) }, [layout])

  useEffect(() => {
    if (!presetsOpen) return
    const handler = (e: MouseEvent) => {
      if (presetsRef.current && !presetsRef.current.contains(e.target as Node)) {
        setPresetsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [presetsOpen])

  const gridStyle: CSSProperties =
    layout === '1x1' ? { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }
    : layout === '1x2' ? { gridTemplateColumns: `${colRatio}fr ${1 - colRatio}fr`, gridTemplateRows: '1fr' }
    : { gridTemplateColumns: `${colRatio}fr ${1 - colRatio}fr`, gridTemplateRows: `${rowRatio}fr ${1 - rowRatio}fr` }

  const resetCol = useCallback(() => setColRatio(0.5), [])
  const resetRow = useCallback(() => setRowRatio(0.5), [])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Layout selector toolbar — only shown for multi-pane layouts */}
      {layout !== '1x1' && (
        <div className="flex items-center justify-end gap-2 px-2 py-1 bg-[var(--bg-darker)] border-b border-[var(--border)]">
          {/* Dashboards presets dropdown */}
          <div className="relative" ref={presetsRef}>
            <button
              onClick={() => setPresetsOpen(v => !v)}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-white/5 hover:bg-white/10 transition-colors text-[var(--text-secondary)]"
            >
              Dashboards
              <svg className="w-2.5 h-2.5 opacity-50" fill="none" viewBox="0 0 10 6"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            {presetsOpen && (
              <div className="absolute top-full right-0 mt-1 w-48 rounded-lg bg-[#1a1f2e] border border-[var(--border)] shadow-xl z-50 py-1">
                {Object.values(LAYOUT_PRESETS).map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => { applyLayoutPreset(preset.id); setPresetsOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/5 transition-colors text-left"
                  >
                    <span>{preset.icon}</span>
                    <div className="flex-1">
                      <div className="text-[var(--text-primary)]">{preset.label}</div>
                      <div className="text-[10px] text-[var(--text-tertiary)]">{preset.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <LayoutSelector value={layout} onChange={setLayout} />
        </div>
      )}

      {/* Chart grid */}
      <div ref={gridWrapperRef} className="relative flex-1 min-h-0">
        <div className="grid gap-1 p-1 absolute inset-0" style={gridStyle}>
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
              widgetType={pane.widgetType}
              onWidgetTypeChange={(type) => setWidgetType(pane.id, type)}
            />
          ))}
        </div>
        {layout !== '1x1' && (
          <ResizeHandle
            direction="vertical"
            ratio={colRatio}
            onRatioChange={setColRatio}
            onReset={resetCol}
            containerRef={gridWrapperRef}
          />
        )}
        {layout === '2x2' && (
          <ResizeHandle
            direction="horizontal"
            ratio={rowRatio}
            onRatioChange={setRowRatio}
            onReset={resetRow}
            containerRef={gridWrapperRef}
          />
        )}
      </div>
    </div>
  )
}
