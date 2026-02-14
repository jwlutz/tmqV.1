import { BacktestResult, EquityPoint } from './types';

function generateEquityCurve(): EquityPoint[] {
  const points: EquityPoint[] = [];
  const startDate = new Date('2020-01-01').getTime() / 1000;
  let value = 100000;

  for (let i = 0; i < 365 * 4; i++) {
    const time = startDate + i * 86400;

    const dailyReturn = (Math.random() - 0.47) * 0.025;
    value *= (1 + dailyReturn);

    if (Math.random() < 0.02) {
      value *= 0.95;
    }

    points.push({ time, value });
  }

  return points;
}

export const MOCK_BACKTEST: BacktestResult = {
  id: 'mock-1',
  strategyName: 'RSI Momentum',
  symbol: 'BTC/USDT',
  startDate: '2020-01-01',
  endDate: '2024-01-01',
  kpis: {
    sharpeRatio: 1.42,
    cagr: 28.5,
    maxDrawdown: -18.3,
    winRate: 58,
    totalTrades: 127,
    profitFactor: 1.87,
    sortinoRatio: 2.15,
    totalReturn: 342,
  },
  equityCurve: generateEquityCurve(),
};
