import { useSettingsOverlay } from '../context'

export function LoadingSkeleton({ label }: { label?: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[var(--bg-dark)]">
      <div className="flex flex-col items-center gap-2">
        <div className="w-6 h-6 border-2 border-[var(--text-tertiary)] border-t-[var(--text-primary)] rounded-full animate-spin" />
        {label && (
          <span className="text-xs text-[var(--text-secondary)]">{label}</span>
        )}
      </div>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[var(--bg-dark)]">
      <div className="flex flex-col items-center gap-2 text-center px-4">
        <span className="text-[var(--red-down)] text-sm font-medium">Error</span>
        <span className="text-xs text-[var(--text-secondary)]">{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-1 px-3 py-1 text-xs rounded bg-white/10 hover:bg-white/15 transition-colors text-[var(--text-primary)]"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  )
}

export function FREDNotConfigured() {
  const { setSettingsOpen } = useSettingsOverlay()

  return (
    <div className="w-full h-full flex items-center justify-center bg-[var(--bg-dark)]">
      <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-[var(--bg-darker)] border border-[var(--border)] max-w-[320px] text-center">
        <span className="text-3xl">&#x1F4CA;</span>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          FRED API Required
        </h3>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          Connect your FRED API key in Settings to enable macro data.
        </p>
        <button
          onClick={() => setSettingsOpen(true)}
          className="px-3 py-1.5 rounded text-xs font-medium bg-[#2962FF]/20 hover:bg-[#2962FF]/30 text-[#2962FF] border border-[#2962FF]/30 transition-colors"
        >
          Open Settings
        </button>
      </div>
    </div>
  )
}
