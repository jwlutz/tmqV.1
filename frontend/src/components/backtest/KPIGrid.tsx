import { BacktestKPIs } from './types';
import { KPICard } from './KPICard';

interface KPIGridProps {
  kpis: BacktestKPIs;
}

export function KPIGrid({ kpis }: KPIGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
      <KPICard
        label="Sharpe Ratio"
        value={kpis.sharpeRatio.toFixed(2)}
        trend={kpis.sharpeRatio > 1 ? 'positive' : kpis.sharpeRatio > 0 ? 'neutral' : 'negative'}
      />
      <KPICard
        label="CAGR"
        value={kpis.cagr.toFixed(1)}
        suffix="%"
        trend={kpis.cagr > 0 ? 'positive' : 'negative'}
      />
      <KPICard
        label="Max Drawdown"
        value={kpis.maxDrawdown.toFixed(1)}
        suffix="%"
        trend="negative"
      />
      <KPICard
        label="Win Rate"
        value={kpis.winRate.toFixed(0)}
        suffix="%"
        trend={kpis.winRate > 50 ? 'positive' : 'neutral'}
      />
      <KPICard
        label="Total Return"
        value={kpis.totalReturn.toFixed(0)}
        suffix="%"
        trend={kpis.totalReturn > 0 ? 'positive' : 'negative'}
      />
      <KPICard
        label="Profit Factor"
        value={kpis.profitFactor.toFixed(2)}
        trend={kpis.profitFactor > 1.5 ? 'positive' : 'neutral'}
      />
      <KPICard
        label="Sortino Ratio"
        value={kpis.sortinoRatio.toFixed(2)}
        trend={kpis.sortinoRatio > 1 ? 'positive' : 'neutral'}
      />
      <KPICard
        label="Total Trades"
        value={kpis.totalTrades}
        trend="neutral"
      />
    </div>
  );
}
