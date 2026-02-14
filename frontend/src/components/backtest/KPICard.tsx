interface KPICardProps {
  label: string;
  value: string | number;
  suffix?: string;
  trend?: 'positive' | 'negative' | 'neutral';
}

export function KPICard({ label, value, suffix = '', trend = 'neutral' }: KPICardProps) {
  const trendColors = {
    positive: 'text-[var(--green-up)]',
    negative: 'text-[var(--red-down)]',
    neutral: 'text-[var(--text-primary)]',
  };

  return (
    <div className="bg-[var(--bg-dark)] rounded-lg p-4 border border-[var(--border)]">
      <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`text-2xl font-mono font-semibold ${trendColors[trend]}`}>
        {value}{suffix}
      </p>
    </div>
  );
}
