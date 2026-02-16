import type { WidgetDefinition } from './types'

interface PlaceholderWidgetProps {
  definition: WidgetDefinition
  width: number
  height: number
}

export function PlaceholderWidget({ definition }: PlaceholderWidgetProps) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[var(--bg-dark)]">
      <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-[var(--bg-darker)] border border-[var(--border)] max-w-[280px] text-center">
        <span className="text-4xl">{definition.icon}</span>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          {definition.label}
        </h3>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          {definition.description}
        </p>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-[var(--text-tertiary)] border border-[var(--border)]">
          Coming Soon
        </span>
      </div>
    </div>
  )
}
