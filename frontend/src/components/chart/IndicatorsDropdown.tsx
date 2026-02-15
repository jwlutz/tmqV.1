import { useState, useRef, useEffect } from 'react'
import { IndicatorConfig } from '../../hooks/useIndicators'

interface IndicatorsDropdownProps {
  indicators: IndicatorConfig[]
  selectedIds: string[]
  onToggle: (id: string) => void
  disabled?: boolean
}

export function IndicatorsDropdown({ indicators, selectedIds, onToggle, disabled }: IndicatorsDropdownProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selectedCount = selectedIds.length

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm
          bg-[var(--bg-darker)] border border-[var(--border)]
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--text-secondary)] cursor-pointer'}
          text-[var(--text-primary)] transition-colors`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Indicators
        {selectedCount > 0 && (
          <span className="px-1.5 py-0.5 text-xs rounded-full bg-[var(--green-up)]/20 text-[var(--green-up)]">
            {selectedCount}
          </span>
        )}
        <svg className="w-3 h-3 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-[#0d1119] border border-[rgba(255,255,255,0.1)] rounded shadow-[0_4px_20px_rgba(0,0,0,0.5)] z-50">
          <div className="p-2 border-b border-[var(--border)]">
            <span className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">Toggle Indicators</span>
          </div>
          <div className="py-1">
            {indicators.map((ind) => {
              const isSelected = selectedIds.includes(ind.id)
              return (
                <button
                  key={ind.id}
                  onClick={() => onToggle(ind.id)}
                  className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--bg-dark)] transition-colors"
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors
                      ${isSelected
                        ? 'border-[var(--green-up)] bg-[var(--green-up)]'
                        : 'border-[var(--border)]'}`}
                    style={isSelected ? { borderColor: ind.color, backgroundColor: ind.color } : undefined}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3 text-[var(--bg-darkest)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span
                    className={isSelected ? '' : 'text-[var(--text-secondary)]'}
                    style={isSelected ? { color: ind.color } : undefined}
                  >
                    {ind.label}
                  </span>
                  {ind.pane === 'separate' && (
                    <span className="text-xs text-[var(--text-tertiary)] ml-auto">pane</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
