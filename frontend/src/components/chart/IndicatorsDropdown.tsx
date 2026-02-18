import { useState, useRef, useEffect } from 'react'
import type { IndicatorConfig, CustomIndicator } from '../../hooks/useIndicators'
import { CustomIndicatorDialog } from './CustomIndicatorDialog'

interface IndicatorsDropdownProps {
  categories: Record<string, IndicatorConfig[]>
  selectedIds: string[]
  onToggle: (id: string) => void
  showVolume: boolean
  onToggleVolume: () => void
  customIndicators: CustomIndicator[]
  onAddCustom: (indicator: CustomIndicator) => void
  onRemoveCustom: (id: string) => void
  disabled?: boolean
}

export function IndicatorsDropdown({
  categories,
  selectedIds,
  onToggle,
  showVolume,
  onToggleVolume,
  customIndicators,
  onAddCustom,
  onRemoveCustom,
  disabled,
}: IndicatorsDropdownProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [customDialogOpen, setCustomDialogOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus()
    }
  }, [open])

  const selectedCount = selectedIds.length + customIndicators.length
  const searchLower = search.toLowerCase()

  // Filter categories by search
  const filteredCategories = Object.entries(categories).reduce<Record<string, IndicatorConfig[]>>(
    (acc, [cat, items]) => {
      if (!search) {
        acc[cat] = items
      } else {
        const filtered = items.filter(
          i => i.label.toLowerCase().includes(searchLower) ||
               i.shortLabel.toLowerCase().includes(searchLower) ||
               i.id.toLowerCase().includes(searchLower)
        )
        if (filtered.length > 0) acc[cat] = filtered
      }
      return acc
    }, {}
  )

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
        <div className="absolute top-full left-0 mt-1 w-64 bg-[#0d1119] border border-[rgba(255,255,255,0.1)] rounded shadow-[0_4px_20px_rgba(0,0,0,0.5)] z-50 max-h-[420px] flex flex-col">
          {/* Search */}
          <div className="p-2 border-b border-[var(--border)]">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search indicators..."
              className="w-full px-2 py-1 text-xs bg-[var(--bg-dark)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--text-secondary)]"
            />
          </div>

          {/* Volume toggle + Custom button */}
          {!search && (
            <div className="px-2 py-1 border-b border-[var(--border)] flex flex-col gap-0.5">
              <button
                onClick={onToggleVolume}
                className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm hover:bg-[var(--bg-dark)] rounded transition-colors"
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors
                    ${showVolume
                      ? 'border-[#64748b] bg-[#64748b]'
                      : 'border-[var(--border)]'}`}
                >
                  {showVolume && (
                    <svg className="w-3 h-3 text-[var(--bg-darkest)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <span className={showVolume ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}>
                  Volume
                </span>
                <span className="text-xs text-[var(--text-tertiary)] ml-auto">bars</span>
              </button>
              <button
                onClick={() => { setOpen(false); setCustomDialogOpen(true) }}
                className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm hover:bg-[var(--bg-dark)] rounded transition-colors text-[var(--text-secondary)]"
              >
                <span className="w-4 h-4 flex items-center justify-center text-[var(--text-tertiary)]">+</span>
                <span>Custom indicator...</span>
              </button>
            </div>
          )}

          {/* Active custom indicators */}
          {!search && customIndicators.length > 0 && (
            <div className="border-b border-[var(--border)]">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                Custom
              </div>
              {customIndicators.map(ci => (
                <div key={ci.id} className="flex items-center gap-2 px-3 py-1 text-sm">
                  <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: ci.color }} />
                  <span className="text-[var(--text-primary)] truncate flex-1">{ci.label}</span>
                  <button
                    onClick={() => onRemoveCustom(ci.id)}
                    className="text-[var(--text-tertiary)] hover:text-[var(--red-down)] transition-colors flex-shrink-0"
                    title="Remove"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Categorized list */}
          <div className="overflow-y-auto flex-1">
            {Object.entries(filteredCategories).map(([category, items]) => (
              <div key={category}>
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] sticky top-0 bg-[#0d1119]">
                  {category}
                </div>
                {items.map(ind => {
                  const isSelected = selectedIds.includes(ind.id)
                  return (
                    <button
                      key={ind.id}
                      onClick={() => onToggle(ind.id)}
                      className="flex items-center gap-2 w-full text-left px-3 py-1 text-sm hover:bg-[var(--bg-dark)] transition-colors"
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors flex-shrink-0
                          ${isSelected
                            ? 'border-[var(--green-up)] bg-[var(--green-up)]'
                            : 'border-[var(--border)]'}`}
                        style={isSelected ? { borderColor: ind.color, backgroundColor: ind.color } : undefined}
                      >
                        {isSelected && (
                          <svg className="w-2.5 h-2.5 text-[var(--bg-darkest)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span
                        className={`truncate ${isSelected ? '' : 'text-[var(--text-secondary)]'}`}
                        style={isSelected ? { color: ind.color } : undefined}
                      >
                        {ind.label}
                      </span>
                      <span className="text-[10px] text-[var(--text-tertiary)] ml-auto flex-shrink-0">
                        {ind.shortLabel}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
            {Object.keys(filteredCategories).length === 0 && (
              <div className="px-3 py-4 text-xs text-[var(--text-tertiary)] text-center">
                No indicators match "{search}"
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom indicator dialog (rendered outside dropdown) */}
      <CustomIndicatorDialog
        open={customDialogOpen}
        onClose={() => setCustomDialogOpen(false)}
        onAdd={onAddCustom}
        existingCount={customIndicators.length}
      />
    </div>
  )
}
