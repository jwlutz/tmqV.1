import type { ScaleMode } from '../../widgets/CandlestickWidget'

interface ScaleToggleProps {
  value: ScaleMode
  onChange: (mode: ScaleMode) => void
  disabled?: boolean
}

const SCALE_OPTIONS: Array<{ mode: ScaleMode; label: string; title: string }> = [
  { mode: 'normal', label: 'Lin', title: 'Linear scale' },
  { mode: 'log', label: 'Log', title: 'Logarithmic scale' },
  { mode: 'percent', label: '%', title: 'Percentage scale' },
]

export function ScaleToggle({ value, onChange, disabled }: ScaleToggleProps) {
  return (
    <div className="flex items-center rounded overflow-hidden border border-[var(--border)]" onClick={e => e.stopPropagation()}>
      {SCALE_OPTIONS.map(opt => (
        <button
          key={opt.mode}
          onClick={() => !disabled && onChange(opt.mode)}
          disabled={disabled}
          title={opt.title}
          className={`px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          } ${
            value === opt.mode
              ? 'bg-[var(--green-up)] text-white'
              : 'bg-transparent text-[var(--text-tertiary)] hover:bg-white/5 hover:text-[var(--text-secondary)]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
