import { test, expect } from '@playwright/test';

test.describe('Mode Toggle', () => {
  test('should switch between Live and Backtest views', async ({ page }) => {
    await page.goto('/');

    // Wait for chart to load (first() since backtest also renders a chart)
    await expect(page.locator('.tv-lightweight-charts').first()).toBeVisible({ timeout: 15000 });

    // Click Backtest in the TopBar toggle
    const backtestToggle = page.locator('header').getByRole('button', { name: /backtest/i });
    await backtestToggle.click();

    // Backtest results should appear
    await expect(page.getByText('Sharpe Ratio')).toBeVisible();
    await expect(page.getByText('CAGR')).toBeVisible();
    await expect(page.getByText('Max Drawdown')).toBeVisible();
    await expect(page.getByText('RSI Momentum')).toBeVisible();

    // Click Live again
    const liveToggle = page.locator('header').getByRole('button', { name: /live/i });
    await liveToggle.click();

    // Chart should be visible again
    await expect(page.locator('.tv-lightweight-charts').first()).toBeVisible();
  });

  test('keyboard shortcuts switch modes', async ({ page }) => {
    await page.goto('/');

    // Wait for app to load
    await expect(page.locator('.tv-lightweight-charts').first()).toBeVisible({ timeout: 15000 });

    // Ctrl+2 to switch to Backtest
    await page.keyboard.press('Control+2');
    await expect(page.getByText('Sharpe Ratio')).toBeVisible();

    // Ctrl+1 to switch to Live
    await page.keyboard.press('Control+1');
    await expect(page.locator('.tv-lightweight-charts').first()).toBeVisible();
  });
});
