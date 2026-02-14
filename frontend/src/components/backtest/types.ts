export interface BacktestKPIs {
  sharpeRatio: number;
  cagr: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  sortinoRatio: number;
  totalReturn: number;
}

export interface EquityPoint {
  time: number;
  value: number;
}

export interface BacktestResult {
  id: string;
  strategyName: string;
  symbol: string;
  startDate: string;
  endDate: string;
  kpis: BacktestKPIs;
  equityCurve: EquityPoint[];
}
