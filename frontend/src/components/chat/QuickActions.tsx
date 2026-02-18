interface QuickAction {
  id: string;
  label: string;
  message: string;
  description: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'backtest',
    label: 'Backtest',
    message: 'Run a momentum backtest on BTC/USDT with default parameters',
    description: 'Run strategy test',
  },
  {
    id: 'stats',
    label: 'Stats',
    message: 'Show me the detailed performance statistics',
    description: 'View metrics',
  },
  {
    id: 'explain',
    label: 'Explain',
    message: 'Explain how the momentum strategy works',
    description: 'Learn strategy',
  },
  {
    id: 'optimize',
    label: 'Optimize',
    message: 'Optimize the RSI period parameter from 10 to 20',
    description: 'Tune parameters',
  },
];

interface QuickActionsProps {
  onAction: (message: string, actionId: string) => void;
  disabled?: boolean;
}

export function QuickActions({ onAction, disabled = false }: QuickActionsProps) {
  return (
    <div className="px-3 py-3 border-b border-[var(--border)]">
      <p className="text-xs text-[var(--text-tertiary)] mb-2 uppercase tracking-wider">
        Examples
      </p>
      <div className="grid grid-cols-2 gap-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.id}
            onClick={() => onAction(action.message, action.id)}
            disabled={disabled}
            className="flex items-center gap-2 px-3 py-2 text-left rounded-lg
                       bg-[var(--bg-medium)]
                       border border-[var(--border)]
                       hover:border-[var(--green-up)]/40 hover:bg-[var(--bg-darkest)]
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)]
                           group-hover:text-[var(--green-up)] transition-colors">
                {action.label}
              </p>
              <p className="text-xs text-[var(--text-tertiary)] truncate">
                {action.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
