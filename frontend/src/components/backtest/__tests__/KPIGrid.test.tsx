import { render, screen } from '@testing-library/react';
import { KPIGrid } from '../KPIGrid';
import { MOCK_BACKTEST } from '../mockData';

test('KPIGrid renders all metrics', () => {
  render(<KPIGrid kpis={MOCK_BACKTEST.kpis} />);

  expect(screen.getByText('Sharpe Ratio')).toBeInTheDocument();
  expect(screen.getByText('CAGR')).toBeInTheDocument();
  expect(screen.getByText('Max Drawdown')).toBeInTheDocument();
  expect(screen.getByText('Win Rate')).toBeInTheDocument();
  expect(screen.getByText('Total Return')).toBeInTheDocument();
  expect(screen.getByText('Profit Factor')).toBeInTheDocument();
  expect(screen.getByText('Sortino Ratio')).toBeInTheDocument();
  expect(screen.getByText('Total Trades')).toBeInTheDocument();
});

test('KPIGrid renders correct values', () => {
  render(<KPIGrid kpis={MOCK_BACKTEST.kpis} />);

  expect(screen.getByText('1.42')).toBeInTheDocument();
  expect(screen.getByText(/28\.5/)).toBeInTheDocument();
  expect(screen.getByText(/-18\.3/)).toBeInTheDocument();
  expect(screen.getByText('127')).toBeInTheDocument();
});
