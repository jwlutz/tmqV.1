import { useMode, useSettingsOverlay } from '../../context'

export function TopBar() {
  const { mode, setMode } = useMode()
  const { setSettingsOpen } = useSettingsOverlay()

  return (
    <header className="h-12 flex-none bg-[var(--bg-dark)] border-b border-[var(--border)] flex items-center justify-between px-3 md:px-4">
      <div className="flex items-center gap-3">
        <a
          href="https://github.com/jwlutz/tmqV.1"
          target="_blank"
          rel="noopener noreferrer"
          className="text-base font-semibold text-[var(--text-primary)] hover:text-[var(--green-up)] transition-colors"
        >
          <span className="hidden sm:inline">thats_my_quant</span>
          <span className="sm:hidden">TMQ</span>
        </a>
      </div>

      <div className="flex items-center gap-2">
        {/* Mode toggle */}
        <div className="flex items-center rounded-full border border-[var(--border)] p-0.5">
          <button
            onClick={() => setMode('live')}
            aria-pressed={mode === 'live'}
            aria-label="Switch to live trading view"
            className={`px-2 py-1 rounded-full text-xs font-medium transition-all ${
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
            className={`px-2 py-1 rounded-full text-xs font-medium transition-all ${
              mode === 'backtest'
                ? 'bg-[var(--green-up)] text-[var(--bg-darkest)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Backtest
          </button>
        </div>

        {/* Settings button */}
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Open settings"
          className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </header>
  )
}
