import { useState, useRef, useEffect } from 'react'

const INTERVALS = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '1D', value: '1d' },
  { label: '1W', value: '1wk' },
  { label: '1M', value: '1mo' },
]

interface IntervalDropdownProps {
  value: string
  onChange: (interval: string) => void
  disabled?: boolean
}

export function IntervalDropdown({ value, onChange, disabled }: IntervalDropdownProps) {
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

  const currentLabel = INTERVALS.find(i => i.value === value)?.label || value

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`flex items-center gap-1 px-2 py-1 rounded text-sm font-mono
          bg-[var(--bg-darker)] border border-[var(--border)]
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--text-secondary)] cursor-pointer'}
          text-[var(--text-primary)] transition-colors`}
      >
        {currentLabel}
        <svg className="w-3 h-3 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-[var(--bg-darker)] border border-[var(--border)] rounded shadow-lg z-50">
          {INTERVALS.map(({ label, value: val }) => (
            <button
              key={val}
              onClick={() => { onChange(val); setOpen(false) }}
              className={`block w-full text-left px-3 py-1.5 text-sm font-mono hover:bg-[var(--bg-dark)] transition-colors
                ${val === value ? 'text-[var(--green-up)]' : 'text-[var(--text-primary)]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
