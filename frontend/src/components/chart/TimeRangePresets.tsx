interface TimeRangePresetsProps {
  value: string | null
  onChange: (range: string) => void
  disabled?: boolean
}

const TIME_RANGES = [
  { value: '1d', label: '1D' },
  { value: '5d', label: '5D' },
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: '5y', label: '5Y' },
  { value: 'all', label: 'All' },
]

export function TimeRangePresets({ value, onChange, disabled }: TimeRangePresetsProps) {
  return (
    <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
      {TIME_RANGES.map(range => (
        <button
          key={range.value}
          onClick={() => !disabled && onChange(range.value)}
          disabled={disabled}
          className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          } ${
            value === range.value
              ? 'bg-[var(--green-up)] text-white'
              : 'text-[var(--text-tertiary)] hover:bg-white/5 hover:text-[var(--text-secondary)]'
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  )
}
