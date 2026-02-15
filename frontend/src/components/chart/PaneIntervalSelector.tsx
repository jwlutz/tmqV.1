import { useState, useRef, useEffect } from 'react'

const INTERVALS = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '1D', value: '1d' },
  { label: '1W', value: '1wk' },
]

interface PaneIntervalSelectorProps {
  value: string
  onChange: (interval: string) => void
}

export function PaneIntervalSelector({ value, onChange }: PaneIntervalSelectorProps) {
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
    <div ref={containerRef} className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-mono
          bg-white/5 border border-[var(--border)]
          hover:border-[var(--text-secondary)] cursor-pointer
          text-[var(--text-primary)] transition-colors"
      >
        {currentLabel}
        <svg className="w-2.5 h-2.5 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-[#0d1119] border border-[rgba(255,255,255,0.1)] rounded shadow-[0_4px_20px_rgba(0,0,0,0.5)] z-50">
          {INTERVALS.map(({ label, value: val }) => (
            <button
              key={val}
              onClick={() => { onChange(val); setOpen(false) }}
              className={`block w-full text-left px-2.5 py-1 text-[11px] font-mono hover:bg-[var(--bg-medium)] transition-colors whitespace-nowrap
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
