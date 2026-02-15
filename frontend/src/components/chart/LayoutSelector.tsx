import { ChartLayout } from '../../context'

interface LayoutSelectorProps {
  value: ChartLayout;
  onChange: (layout: ChartLayout) => void;
}

const layouts: { value: ChartLayout; label: string }[] = [
  { value: '1x1', label: 'Single chart' },
  { value: '1x2', label: 'Two charts' },
  { value: '2x2', label: 'Four charts' },
]

function LayoutIcon({ layout, active }: { layout: ChartLayout; active: boolean }) {
  const fill = active ? 'var(--green-up)' : 'currentColor'
  const gap = 1.5

  if (layout === '1x1') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="0.5" y="0.5" width="13" height="13" rx="1.5" stroke={fill} strokeWidth="1.2" />
      </svg>
    )
  }

  if (layout === '1x2') {
    const w = (14 - gap) / 2
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="0.5" y="0.5" width={w - 0.5} height="13" rx="1.5" stroke={fill} strokeWidth="1.2" />
        <rect x={w + gap} y="0.5" width={w - 0.5} height="13" rx="1.5" stroke={fill} strokeWidth="1.2" />
      </svg>
    )
  }

  // 2x2
  const w = (14 - gap) / 2
  const h = (14 - gap) / 2
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="0.5" y="0.5" width={w - 0.5} height={h - 0.5} rx="1" stroke={fill} strokeWidth="1.2" />
      <rect x={w + gap} y="0.5" width={w - 0.5} height={h - 0.5} rx="1" stroke={fill} strokeWidth="1.2" />
      <rect x="0.5" y={h + gap} width={w - 0.5} height={h - 0.5} rx="1" stroke={fill} strokeWidth="1.2" />
      <rect x={w + gap} y={h + gap} width={w - 0.5} height={h - 0.5} rx="1" stroke={fill} strokeWidth="1.2" />
    </svg>
  )
}

export function LayoutSelector({ value, onChange }: LayoutSelectorProps) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded border border-[var(--border)]">
      {layouts.map(l => (
        <button
          key={l.value}
          onClick={() => onChange(l.value)}
          aria-label={l.label}
          aria-pressed={value === l.value}
          className={`p-1 rounded transition-colors ${
            value === l.value
              ? 'bg-white/10 text-[var(--green-up)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/5'
          }`}
        >
          <LayoutIcon layout={l.value} active={value === l.value} />
        </button>
      ))}
    </div>
  )
}
