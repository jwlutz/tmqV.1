import { useMode } from '../../context'

export function TopBar() {
  const { mode, setMode } = useMode()

  return (
    <header className="h-14 flex-none bg-[var(--bg-dark)] border-b border-[var(--border)] flex items-center justify-between px-3 md:px-4">
      <span className="text-lg font-semibold text-[var(--text-primary)]">
        <span className="hidden sm:inline">thats_my_quant</span>
        <span className="sm:hidden">TMQ</span>
      </span>

      <div className="flex items-center rounded-full border border-[var(--border)] p-0.5 md:p-1">
        <button
          onClick={() => setMode('live')}
          aria-pressed={mode === 'live'}
          aria-label="Switch to live trading view"
          className={`px-2 md:px-4 py-1 md:py-1.5 rounded-full text-xs md:text-sm font-medium transition-all ${
            mode === 'live'
              ? 'bg-[var(--green-up)] text-[var(--bg-darkest)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Live
        </button>
        <button
          onClick={() => setMode('backtest')}
          aria-pressed={mode === 'backtest'}
          aria-label="Switch to backtest results view"
          className={`px-2 md:px-4 py-1 md:py-1.5 rounded-full text-xs md:text-sm font-medium transition-all ${
            mode === 'backtest'
              ? 'bg-[var(--green-up)] text-[var(--bg-darkest)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Backtest
        </button>
      </div>
    </header>
  )
}
