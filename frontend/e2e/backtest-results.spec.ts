import { test, expect } from '@playwright/test';

test.describe('Backtest Results', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Click the TopBar backtest toggle
    await page.locator('header').getByRole('button', { name: /backtest/i }).click();
  });

  test('displays all KPIs', async ({ page }) => {
    const kpis = [
      'Sharpe Ratio',
      'CAGR',
      'Max Drawdown',
      'Win Rate',
      'Total Return',
      'Profit Factor',
      'Sortino Ratio',
      'Total Trades',
    ];

    for (const kpi of kpis) {
      await expect(page.getByText(kpi)).toBeVisible();
    }
  });

  test('equity curve chart renders', async ({ page }) => {
    // Chart should render (lightweight-charts creates canvas elements)
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('shows strategy metadata', async ({ page }) => {
    await expect(page.getByText('RSI Momentum')).toBeVisible();
    await expect(page.getByText('BTC/USDT')).toBeVisible();
    await expect(page.getByText(/2020.*2024/)).toBeVisible();
  });
});
