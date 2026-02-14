import { KPIGrid } from './KPIGrid';
import { EquityCurveChart } from './EquityCurveChart';
import { MOCK_BACKTEST } from './mockData';

export function BacktestResults() {
  const result = MOCK_BACKTEST;

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {result.strategyName}
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {result.symbol} &middot; {result.startDate} to {result.endDate}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-sm rounded-lg bg-[var(--bg-dark)]
                            border border-[var(--border)] text-[var(--text-secondary)]
                            hover:text-[var(--text-primary)] transition-colors">
            Export
          </button>
          <button className="px-3 py-1.5 text-sm rounded-lg bg-[var(--green-up)]
                            text-[var(--bg-darkest)] font-medium
                            hover:brightness-110 transition-all">
            Run Again
          </button>
        </div>
      </div>

      <KPIGrid kpis={result.kpis} />

      <div className="flex-1 rounded-lg border border-[var(--border)] overflow-hidden min-h-[300px]">
        <EquityCurveChart data={result.equityCurve} />
      </div>
    </div>
  );
}
