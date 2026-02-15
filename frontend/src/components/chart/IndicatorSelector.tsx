import { IndicatorConfig } from '../../hooks/useIndicators';

interface IndicatorSelectorProps {
  indicators: IndicatorConfig[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
}

export function IndicatorSelector({
  indicators,
  selectedIds,
  onToggle,
  disabled = false,
}: IndicatorSelectorProps) {
  return (
    <div className="flex gap-1 flex-wrap">
      {indicators.map((ind) => {
        const isSelected = selectedIds.includes(ind.id);
        return (
          <button
            key={ind.id}
            onClick={() => onToggle(ind.id)}
            disabled={disabled}
            className={`px-2 py-0.5 text-xs rounded-full border transition-all
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              ${isSelected
                ? 'border-[var(--green-up)] text-[var(--green-up)] bg-[var(--green-up)]/10'
                : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            style={isSelected ? { borderColor: ind.color, color: ind.color, backgroundColor: `${ind.color}15` } : undefined}
          >
            {ind.label}
          </button>
        );
      })}
    </div>
  );
}
