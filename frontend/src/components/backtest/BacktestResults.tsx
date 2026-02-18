import { useState, useEffect } from 'react';
import { KPIGrid } from './KPIGrid';
import { EquityCurveChart, OHLCVPoint, ChartDisplayOptions } from './EquityCurveChart';
import { useBacktest, useInterval } from '../../context';
import { BacktestKPIs, EquityPoint } from './types';
import { fetchOHLCV } from '../../api/client';
import type { APIBacktestResult } from '../../context';
import { useLocalStorage } from '../../hooks/useLocalStorage';

function mapKPIs(metrics: APIBacktestResult['metrics']): BacktestKPIs {
  return {
    sharpeRatio: metrics.sharpe,
    cagr: metrics.cagr * 100,           // backend returns decimal, frontend shows %
    maxDrawdown: metrics.max_drawdown * 100,
    winRate: metrics.win_rate * 100,
    totalTrades: metrics.total_trades,
    profitFactor: metrics.profit_factor,
    sortinoRatio: 0,                     // backend doesn't provide sortino
    totalReturn: metrics.total_return * 100,
  };
}

function mapEquityCurve(curve: APIBacktestResult['equity_curve']): EquityPoint[] {
  return curve.map(p => ({
    time: Math.floor(new Date(p.date).getTime() / 1000),
    value: p.equity,
  }));
}

export function BacktestResults() {
  const { backtestResult } = useBacktest();
  const { interval } = useInterval();
  const [ohlcv, setOhlcv] = useState<OHLCVPoint[]>([]);

  // Display toggles (persisted)
  const [showPrice, setShowPrice] = useLocalStorage('backtest.showPrice', true);
  const [showEquity, setShowEquity] = useLocalStorage('backtest.showEquity', true);
  const [showTrades, setShowTrades] = useLocalStorage('backtest.showTrades', true);

  const displayOptions: ChartDisplayOptions = { showPrice, showEquity, showTrades };

  // Fetch OHLCV data when backtest result changes
  useEffect(() => {
    if (!backtestResult) {
      setOhlcv([]);
      return;
    }

    const startDate = backtestResult.equity_curve[0]?.date;
    const endDate = backtestResult.equity_curve[backtestResult.equity_curve.length - 1]?.date;
    if (!startDate || !endDate) return;

    let cancelled = false;
    fetchOHLCV(backtestResult.symbol, interval, startDate, endDate)
      .then(res => {
        if (cancelled) return;
        const points: OHLCVPoint[] = res.data.map((d: { date: string; open: number; high: number; low: number; close: number; volume: number }) => ({
          time: Math.floor(new Date(d.date).getTime() / 1000),
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume,
        }));
        setOhlcv(points);
      })
      .catch(err => {
        console.error('Failed to fetch OHLCV for backtest chart:', err);
      });

    return () => { cancelled = true; };
  }, [backtestResult, interval]);

  if (!backtestResult) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="text-4xl mb-4 opacity-30">&#128202;</div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          No Backtest Results
        </h2>
        <p className="text-sm text-[var(--text-secondary)] max-w-md">
          Run a backtest from the chat to see results here. Try asking
          "Backtest BTC/USD with SMA crossover" or use the Backtest quick action.
        </p>
      </div>
    );
  }

  const kpis = mapKPIs(backtestResult.metrics);
  const equityCurve = mapEquityCurve(backtestResult.equity_curve);
  const startDate = backtestResult.equity_curve[0]?.date ?? '';
  const endDate = backtestResult.equity_curve[backtestResult.equity_curve.length - 1]?.date ?? '';

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {backtestResult.strategy}
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {backtestResult.symbol} &middot; {startDate} to {endDate}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Display toggles */}
          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showPrice}
                onChange={e => setShowPrice(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-[var(--border)] bg-[var(--bg-dark)] text-[var(--green-up)] focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-[var(--text-secondary)]">Price</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showEquity}
                onChange={e => setShowEquity(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-[var(--border)] bg-[var(--bg-dark)] text-[var(--green-up)] focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-[var(--text-secondary)]">Equity</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showTrades}
                onChange={e => setShowTrades(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-[var(--border)] bg-[var(--bg-dark)] text-[var(--green-up)] focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-[var(--text-secondary)]">Trades</span>
            </label>
          </div>
          <button className="px-3 py-1.5 text-sm rounded-lg bg-[var(--bg-dark)]
                            border border-[var(--border)] text-[var(--text-secondary)]
                            hover:text-[var(--text-primary)] transition-colors">
            Export
          </button>
        </div>
      </div>

      <KPIGrid kpis={kpis} />

      <div className="flex-1 rounded-lg border border-[var(--border)] overflow-hidden min-h-[300px]">
        <EquityCurveChart
          data={equityCurve}
          ohlcv={ohlcv}
          trades={backtestResult.trades}
          options={displayOptions}
        />
      </div>
    </div>
  );
}
