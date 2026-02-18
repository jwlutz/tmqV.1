import { useState, useRef, useEffect } from 'react'
import { useSettingsOverlay } from '../../context'

type PaneType = 'chart' | 'chat' | 'code' | 'backtest' | 'rot'

const PANE_OPTIONS: { type: PaneType; label: string; icon: string }[] = [
  { type: 'chart', label: 'Chart', icon: '\u{1F4C8}' },
  { type: 'chat', label: 'Chat', icon: '\u{1F4AC}' },
  { type: 'code', label: 'Code', icon: '\u{1F4BB}' },
  { type: 'backtest', label: 'Backtest', icon: '\u{1F4CA}' },
  { type: 'rot', label: 'Rot', icon: '\u{1F9E0}' },
]

export function TopBar() {
  const { setSettingsOpen } = useSettingsOverlay()

  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on outside click
  useEffect(() => {
    if (!addMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [addMenuOpen])

  const handleAddPane = (type: PaneType) => {
    // Call the FlexLayout addTab function exposed on window
    const addTab = (window as any).__flexLayoutAddTab
    if (addTab) {
      addTab(type)
    }
    setAddMenuOpen(false)
  }

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

        {/* Add pane dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setAddMenuOpen(v => !v)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
                       bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                       transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Add</span>
            <svg className="w-2.5 h-2.5 opacity-50" fill="none" viewBox="0 0 10 6">
              <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {addMenuOpen && (
            <div className="absolute top-full left-0 mt-1 w-36 rounded-lg bg-[#1a1f2e] border border-[var(--border)] shadow-xl z-50 py-1">
              {PANE_OPTIONS.map(opt => (
                <button
                  key={opt.type}
                  onClick={() => handleAddPane(opt.type)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors hover:bg-white/5 text-[var(--text-primary)]"
                >
                  <span className="text-sm">{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
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