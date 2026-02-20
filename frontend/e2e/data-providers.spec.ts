import { test, expect } from '@playwright/test';

/**
 * E2E tests for data provider resilience.
 * Tests that the UI handles empty/failed data gracefully without crashing.
 *
 * These tests verify that when data providers return empty results,
 * the frontend displays appropriate messages instead of crashing.
 */

test.describe('Data Provider Resilience', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to load
    await page.waitForSelector('.flexlayout__tab', { timeout: 10000 });
  });

  test('chart handles empty OHLCV data gracefully', async ({ page }) => {
    // Intercept OHLCV requests and return empty data (matching actual API format)
    await page.route('**/api/data/ohlcv*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          symbol: 'EMPTY-TEST',
          interval: '1d',
          data: [],
        }),
      });
    });

    // Change symbol to trigger a new data fetch
    await page.evaluate(() => {
      const activeTabId = window.__activeChartTabId;
      if (!activeTabId) throw new Error('No active tab');
      const setSymbol = window.__chartSetSymbol?.get(activeTabId);
      if (setSymbol) setSymbol('EMPTY-TEST');
    });

    // Wait for the state update and request to complete
    await page.waitForFunction(() => {
      const activeTabId = window.__activeChartTabId;
      if (!activeTabId) return false;
      const getState = window.__chartGetState?.get(activeTabId);
      return getState?.().symbol === 'EMPTY-TEST';
    }, { timeout: 5000 });

    // The page should NOT show "Error rendering component"
    const errorText = page.locator('text=Error rendering component');
    await expect(errorText).not.toBeVisible();

    // Should show some kind of "no data" state instead of crashing
    // (The exact UI may vary, but it shouldn't be an error)
  });

  test('chart handles API error gracefully', async ({ page }) => {
    // Intercept OHLCV requests and return 500 error
    await page.route('**/api/data/ohlcv*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    // Change symbol to trigger a new data fetch
    await page.evaluate(() => {
      const activeTabId = window.__activeChartTabId;
      if (!activeTabId) throw new Error('No active tab');
      const setSymbol = window.__chartSetSymbol?.get(activeTabId);
      if (setSymbol) setSymbol('ERROR-TEST');
    });

    // Wait for the state update
    await page.waitForFunction(() => {
      const activeTabId = window.__activeChartTabId;
      if (!activeTabId) return false;
      const getState = window.__chartGetState?.get(activeTabId);
      return getState?.().symbol === 'ERROR-TEST';
    }, { timeout: 5000 });

    // The app should not crash - check console for unhandled errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Give time for any errors to appear
    await page.waitForTimeout(200);

    // Filter out expected/handled errors
    const unhandledErrors = consoleErrors.filter(
      (err) => !err.includes('Failed to fetch') && !err.includes('500')
    );

    // Should have no unhandled React errors
    const reactErrors = unhandledErrors.filter(
      (err) => err.includes('Uncaught') || err.includes('unhandled')
    );
    expect(reactErrors.length).toBe(0);
  });

  test('valid symbol still works after failed request', async ({ page }) => {
    let requestCount = 0;

    // First request fails, subsequent requests succeed
    // Note: Using equity symbols (not crypto) so they go through backend API, not Coinbase
    await page.route('**/api/data/ohlcv*', async (route) => {
      requestCount++;
      if (requestCount === 1) {
        // First request: return empty data (matching actual API format)
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            symbol: 'INVALID-STOCK',
            interval: '1d',
            data: [],
          }),
        });
      } else {
        // Subsequent requests: let them through
        await route.continue();
      }
    });

    // First request with "bad" equity symbol (non-crypto uses backend API)
    await page.evaluate(() => {
      const activeTabId = window.__activeChartTabId;
      if (!activeTabId) throw new Error('No active tab');
      const setSymbol = window.__chartSetSymbol?.get(activeTabId);
      if (setSymbol) setSymbol('INVALID-STOCK');
    });

    // Wait for state update
    await page.waitForFunction(() => {
      const activeTabId = window.__activeChartTabId;
      if (!activeTabId) return false;
      const getState = window.__chartGetState?.get(activeTabId);
      return getState?.().symbol === 'INVALID-STOCK';
    }, { timeout: 5000 });

    // Second request with good equity symbol should work
    await page.evaluate(() => {
      const activeTabId = window.__activeChartTabId;
      if (!activeTabId) throw new Error('No active tab');
      const setSymbol = window.__chartSetSymbol?.get(activeTabId);
      if (setSymbol) setSymbol('AAPL');
    });

    // Wait for recovery - state update to AAPL
    await page.waitForFunction(() => {
      const activeTabId = window.__activeChartTabId;
      if (!activeTabId) return false;
      const getState = window.__chartGetState?.get(activeTabId);
      return getState?.().symbol === 'AAPL';
    }, { timeout: 10000 });

    // Should have made at least 2 requests (first fail + recovery attempt)
    expect(requestCount).toBeGreaterThanOrEqual(2);

    // No crash error should be visible
    const errorText = page.locator('text=Error rendering component');
    await expect(errorText).not.toBeVisible();
  });

  test('backtest endpoint handles empty data', async ({ page }) => {
    // Intercept backtest requests
    await page.route('**/api/backtest*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          metrics: {
            total_return: 0,
            sharpe_ratio: 0,
            max_drawdown: 0,
            win_rate: 0,
            total_trades: 0,
          },
          equity_curve: [],
          trades: [],
        }),
      });
    });

    // Navigate to backtest tab if it exists
    const backtestTab = page.locator('.flexlayout__tab_button:has-text("Backtest")');
    if (await backtestTab.isVisible()) {
      await backtestTab.click();
      // Wait for tab to be active
      await page.waitForSelector('.flexlayout__tab_button--selected:has-text("Backtest")', { timeout: 5000 });

      // Should not crash with empty backtest data
      const errorText = page.locator('text=Error rendering component');
      await expect(errorText).not.toBeVisible();
    }
  });
});
