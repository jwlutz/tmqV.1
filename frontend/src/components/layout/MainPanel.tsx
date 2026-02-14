import { useMode } from '../../context'
import { LiveChart } from '../chart'
import { BacktestResults } from '../backtest'

export function MainPanel() {
  const { mode } = useMode()

  return (
    <main className="flex-1 bg-[var(--bg-darkest)] overflow-hidden relative">
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          mode === 'live' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
        }`}
      >
        <div className="w-full h-full p-4">
          <div className="w-full h-full rounded-lg overflow-hidden border border-[var(--border)]">
            <LiveChart />
          </div>
        </div>
      </div>

      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          mode === 'backtest' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
        }`}
      >
        <BacktestResults />
      </div>
    </main>
  )
}
