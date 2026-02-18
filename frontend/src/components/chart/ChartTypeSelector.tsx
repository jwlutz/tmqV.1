import { useState, useRef, useEffect } from 'react'
import type { ChartType } from '../../widgets/CandlestickWidget'

interface ChartTypeSelectorProps {
  value: ChartType
  onChange: (type: ChartType) => void
  disabled?: boolean
}

const CHART_TYPES: Array<{ type: ChartType; label: string; icon: string }> = [
  { type: 'candles', label: 'Candles', icon: '🕯️' },
  { type: 'hollow', label: 'Hollow candles', icon: '⬜' },
  { type: 'bars', label: 'Bars', icon: '📊' },
  { type: 'hlc', label: 'HLC bars', icon: '📈' },
  { type: 'line', label: 'Line', icon: '📉' },
  { type: 'area', label: 'Area', icon: '📐' },
  { type: 'baseline', label: 'Baseline', icon: '⚖️' },
]

export function ChartTypeSelector({ value, onChange, disabled }: ChartTypeSelectorProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const current = CHART_TYPES.find(t => t.type === value) || CHART_TYPES[0]

  return (
    <div className="relative" ref={menuRef} onClick={e => e.stopPropagation()}>
      <button
        onClick={() => !disabled && setOpen(v => !v)}
        disabled={disabled}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10'
        } bg-white/5 text-[var(--text-secondary)]`}
        title="Chart type"
      >
        <span className="text-[10px]">{current.icon}</span>
        <svg className="w-2.5 h-2.5 opacity-50" fill="none" viewBox="0 0 10 6">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-40 rounded-lg bg-[#1e222d] border border-[var(--border)] shadow-xl z-50 py-1">
          {CHART_TYPES.map(ct => (
            <button
              key={ct.type}
              onClick={() => { onChange(ct.type); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/5 transition-colors text-left ${
                ct.type === value ? 'text-[var(--green-up)]' : 'text-[var(--text-primary)]'
              }`}
            >
              <span className="w-5 text-center text-[10px]">{ct.icon}</span>
              <span className="flex-1">{ct.label}</span>
              {ct.type === value && <span>&#10003;</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
