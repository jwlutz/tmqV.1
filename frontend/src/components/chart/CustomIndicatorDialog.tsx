import { useState, useRef, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import type { CustomIndicator } from '../../hooks/useIndicators'

const INDICATOR_COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#6366f1',
]

const DEFAULT_CODE = `// Custom indicator function
// 'bars' is an array of { time, open, high, low, close, volume }
// Return an array of { time, value }

// Example: 10-period SMA
const period = 10;
const result = [];
for (let i = period - 1; i < bars.length; i++) {
  let sum = 0;
  for (let j = 0; j < period; j++) {
    sum += bars[i - j].close;
  }
  result.push({ time: bars[i].time, value: sum / period });
}
return result;`

interface CustomIndicatorDialogProps {
  open: boolean
  onClose: () => void
  onAdd: (indicator: CustomIndicator) => void
  existingCount: number
}

export function CustomIndicatorDialog({ open, onClose, onAdd, existingCount }: CustomIndicatorDialogProps) {
  const [name, setName] = useState('')
  const [code, setCode] = useState(DEFAULT_CODE)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const handleAdd = () => {
    const label = name.trim() || `Custom ${existingCount + 1}`
    setError(null)

    // Validate by trying to compile
    try {
      new Function('bars', code)
    } catch (e) {
      setError(`Syntax error: ${e instanceof Error ? e.message : String(e)}`)
      return
    }

    const color = INDICATOR_COLORS[existingCount % INDICATOR_COLORS.length]
    onAdd({
      id: `custom-${Date.now()}`,
      label,
      color,
      code,
    })
    setName('')
    setCode(DEFAULT_CODE)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        ref={dialogRef}
        className="w-[560px] max-h-[80vh] bg-[#0d1119] border border-[var(--border)] rounded-lg shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Custom Indicator</h3>
          <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Name input */}
        <div className="px-4 py-2">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Indicator name (optional)"
            className="w-full px-3 py-1.5 text-sm bg-[var(--bg-dark)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--text-secondary)]"
          />
        </div>

        {/* Code editor */}
        <div className="flex-1 min-h-0 px-4 pb-2">
          <div className="text-[10px] text-[var(--text-tertiary)] mb-1">
            Write a function body. Input: <code className="text-[var(--text-secondary)]">bars</code> (OHLCV array). Return: <code className="text-[var(--text-secondary)]">[{'{time, value}'}]</code>
          </div>
          <div className="border border-[var(--border)] rounded overflow-hidden h-[280px]">
            <Editor
              height="100%"
              language="javascript"
              theme="vs-dark"
              value={code}
              onChange={v => setCode(v ?? '')}
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                tabSize: 2,
                padding: { top: 8 },
              }}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-1">
            <p className="text-xs text-[var(--red-down)]">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            className="px-3 py-1.5 text-sm rounded bg-[var(--green-up)] text-[var(--bg-darkest)] font-medium hover:brightness-110 transition-all"
          >
            Add Indicator
          </button>
        </div>
      </div>
    </div>
  )
}
