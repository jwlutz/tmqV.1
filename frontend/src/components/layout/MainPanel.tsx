import { useRef, useCallback } from 'react'
import { useMode, useCodePanel } from '../../context'
import { ChartGrid } from '../chart/ChartGrid'
import { BacktestResults } from '../backtest'
import { CodePanel } from '../code'
import { ResizeHandle } from '../chart/ResizeHandle'
import { useLocalStorage } from '../../hooks/useLocalStorage'

export function MainPanel({ style }: { style?: React.CSSProperties }) {
  const { mode } = useMode()
  const { codePanelOpen } = useCodePanel()
  const mainRef = useRef<HTMLElement>(null)
  const [codeRatio, setCodeRatio] = useLocalStorage('codePanelRatio', 0.25)
  const resetCode = useCallback(() => setCodeRatio(0.25), [])

  return (
    <main ref={mainRef} className="relative bg-[var(--bg-darkest)] overflow-hidden flex flex-col min-h-0" style={{ ...style, flexShrink: 0 }}>
      {/* Chart area — always rendered, hidden when backtest is active */}
      <div
        className={`flex flex-col min-h-0 transition-opacity duration-300 ${
          mode === 'live' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none absolute inset-0'
        }`}
        style={codePanelOpen ? { height: `${(1 - codeRatio) * 100}%` } : { flex: 1 }}
      >
        <ChartGrid />
      </div>

      {/* Backtest results — shown over chart area */}
      <div
        className={`transition-opacity duration-300 ${
          mode === 'backtest' ? 'opacity-100 z-10 min-h-0' : 'opacity-0 z-0 pointer-events-none absolute inset-0'
        }`}
        style={codePanelOpen ? { height: `${(1 - codeRatio) * 100}%` } : { flex: 1 }}
      >
        <BacktestResults />
      </div>

      {/* Code panel — always visible at bottom (collapsible) */}
      <div className={`z-20 relative ${codePanelOpen ? '' : 'flex-none'}`} style={codePanelOpen ? { height: `${codeRatio * 100}%`, flexShrink: 0 } : undefined}>
        <CodePanel />
      </div>

      {/* Resize handle between chart and code panel */}
      {codePanelOpen && (
        <ResizeHandle
          direction="horizontal"
          ratio={1 - codeRatio}
          onRatioChange={(r) => setCodeRatio(1 - r)}
          onReset={resetCode}
          containerRef={mainRef}
          className="absolute z-30"
        />
      )}
    </main>
  )
}
