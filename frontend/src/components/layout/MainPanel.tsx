import { useMode } from '../../context'
import { ChartGrid } from '../chart/ChartGrid'
import { BacktestResults } from '../backtest'
import { CodePanel } from '../code'

export function MainPanel() {
  const { mode } = useMode()

  return (
    <main className="flex-1 bg-[var(--bg-darkest)] overflow-hidden flex flex-col min-h-0">
      {/* Chart area — always rendered, hidden when backtest is active */}
      <div
        className={`flex flex-col flex-1 min-h-0 transition-opacity duration-300 ${
          mode === 'live' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none absolute inset-0'
        }`}
      >
        <ChartGrid />
      </div>

      {/* Backtest results — shown over chart area */}
      <div
        className={`transition-opacity duration-300 ${
          mode === 'backtest' ? 'opacity-100 z-10 flex-1 min-h-0' : 'opacity-0 z-0 pointer-events-none absolute inset-0'
        }`}
      >
        <BacktestResults />
      </div>

      {/* Code panel — always visible at bottom (collapsible) */}
      <div className="flex-none z-20 relative">
        <CodePanel />
      </div>
    </main>
  )
}
