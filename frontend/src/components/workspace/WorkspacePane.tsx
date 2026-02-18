import type { ReactNode } from 'react'

interface WorkspacePaneProps {
  id: string
  title: string
  onClose: () => void
  children: ReactNode
}

export function WorkspacePane({ title, onClose, children }: WorkspacePaneProps) {
  return (
    <div className="flex flex-col h-full bg-[var(--bg-dark)] border border-[var(--border)] rounded-lg overflow-hidden">
      {/* Pane header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--bg-darker)] border-b border-[var(--border)]">
        <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          {title}
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/10 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          aria-label={`Close ${title} pane`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Pane content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
