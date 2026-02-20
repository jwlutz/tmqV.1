import { test, expect } from '@playwright/test';

test.describe('Backtest Results UI', () => {
  test('shows empty state when no results', async ({ page }) => {
    await page.goto('/');

    // Wait for app to load
    await expect(page.locator('.flexlayout__tab_button').filter({ hasText: 'Chart' })).toBeVisible({ timeout: 15000 });

    // Open Backtest tab via window function
    await page.evaluate(() => {
      (window as any).__flexLayoutAddTab('backtest');
    });

    // Should show "No Backtest Results" message
    await expect(page.getByText('No Backtest Results')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/run a backtest from the chat/i)).toBeVisible();
  });
});

// Test the confirmation modal flow
test.describe('Action Confirmation Modal', () => {
  // Run AI tests serially to avoid rate limits
  test.describe.configure({ mode: 'serial' });
  test.skip(({ }, testInfo) => !process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY, 'Requires AI API key');

  test('shows confirmation modal when AI calls backtest tool', async ({ page }) => {
    // Fresh state - no auto-approve preferences
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.locator('.flexlayout__tab_button').filter({ hasText: 'Chart' })).toBeVisible({ timeout: 15000 });

    // Navigate to Chat tab
    await page.locator('.flexlayout__tab_button').filter({ hasText: 'Chat' }).click();
    await expect(page.getByText(/welcome to thats_my_quant/i)).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    // Click the Backtest quick action
    const backtestAction = page.locator('button').filter({ hasText: 'Backtest' }).filter({ hasText: 'Run strategy test' });
    await backtestAction.click();

    // Confirmation modal should appear (look for "Run Backtest?" text)
    // AI may take time to process and call the tool, so allow longer timeout
    await expect(page.getByText(/Run Backtest\?/i)).toBeVisible({ timeout: 60000 });

    // Modal should show the tool parameters
    await expect(page.getByText(/click to run/i)).toBeVisible();

    // Click the modal to approve
    await page.locator('text=click to run').click();

    // After approval, backtest should run and tab should open
    await expect(page.locator('.flexlayout__tab_button').filter({ hasText: 'Backtest' })).toBeVisible({ timeout: 90000 });
  });

  // Skip: AI timing is unpredictable - AI may not call backtest tool within timeout
  test.skip('allows user to cancel via backdrop click', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.locator('.flexlayout__tab_button').filter({ hasText: 'Chart' })).toBeVisible({ timeout: 15000 });
    await page.locator('.flexlayout__tab_button').filter({ hasText: 'Chat' }).click();
    await expect(page.getByText(/welcome to thats_my_quant/i)).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    // Click the Backtest quick action
    const backtestAction = page.locator('button').filter({ hasText: 'Backtest' }).filter({ hasText: 'Run strategy test' });
    await backtestAction.click();

    // Wait for modal (AI may take time to process and call the tool)
    await expect(page.getByText(/Run Backtest\?/i)).toBeVisible({ timeout: 60000 });

    // Click the backdrop to cancel
    await page.locator('.fixed.inset-0.bg-black\\/30').click();

    // Modal should close and message should show "cancelled"
    await expect(page.getByText(/cancelled by user/i)).toBeVisible({ timeout: 5000 });

    // Backtest tab should NOT appear
    await expect(page.locator('.flexlayout__tab_button').filter({ hasText: 'Backtest' })).not.toBeVisible();
  });
});

// Tests that require AI API keys to run a real backtest
test.describe('Backtest AI Integration', () => {
  // Run AI tests serially to avoid rate limits
  test.describe.configure({ mode: 'serial' });
  // Skip if no API key is configured
  test.skip(({ }, testInfo) => !process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY, 'Requires AI API key');

  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure clean state and force provider auto-selection
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      // Auto-approve backtest actions so modal doesn't block tests
      // Note: useLocalStorage prefixes keys with 'tmq:'
      localStorage.setItem('tmq:actionPreferences', JSON.stringify({
        mode: 'ask',
        autoApprove: { backtest: true, indicator: true, widget: true, code: true }
      }));
    });
    await page.reload();

    // Wait for app to fully load and server config to be fetched
    await expect(page.locator('.flexlayout__tab_button').filter({ hasText: 'Chart' })).toBeVisible({ timeout: 15000 });

    // Navigate to Chat tab
    await page.locator('.flexlayout__tab_button').filter({ hasText: 'Chat' }).click();
    await expect(page.getByText(/welcome to thats_my_quant/i)).toBeVisible({ timeout: 10000 });

    // Wait for server config to be fetched and provider to be auto-selected
    await page.waitForTimeout(1500);
  });

  test('backtest quick action opens results tab', async ({ page }) => {
    // Click the Backtest quick action
    const backtestAction = page.locator('button').filter({ hasText: 'Backtest' }).filter({ hasText: 'Run strategy test' });
    await backtestAction.click();

    // User message should appear
    await expect(page.getByText(/Run a momentum backtest/i)).toBeVisible({ timeout: 5000 });

    // Wait for backtest to complete and results tab to open
    await expect(page.locator('.flexlayout__tab_button').filter({ hasText: 'Backtest' })).toBeVisible({ timeout: 90000 });

    // Click the Backtest tab to view results
    await page.locator('.flexlayout__tab_button').filter({ hasText: 'Backtest' }).click();

    // Wait for the backtest results heading to confirm tab is active
    await expect(page.getByRole('heading', { name: /momentum|sma_crossover|rsi_mean_reversion/i })).toBeVisible({ timeout: 10000 });

    // KPIs should be visible (scope to paragraph elements in the results grid)
    await expect(page.getByRole('paragraph').filter({ hasText: 'Sharpe Ratio' })).toBeVisible();
    await expect(page.getByRole('paragraph').filter({ hasText: 'CAGR' })).toBeVisible();
    await expect(page.getByRole('paragraph').filter({ hasText: 'Max Drawdown' })).toBeVisible();
    await expect(page.getByRole('paragraph').filter({ hasText: 'Win Rate' })).toBeVisible();
  });

  // Skip: Depends on prior test completing - AI timing unpredictable
  test.skip('displays all KPIs after backtest completes', async ({ page }) => {
    // Run backtest via quick action
    const backtestAction = page.locator('button').filter({ hasText: 'Backtest' }).filter({ hasText: 'Run strategy test' });
    await backtestAction.click();

    // Wait for Backtest tab to appear
    await expect(page.locator('.flexlayout__tab_button').filter({ hasText: 'Backtest' })).toBeVisible({ timeout: 90000 });
    await page.locator('.flexlayout__tab_button').filter({ hasText: 'Backtest' }).click();

    // Wait for the backtest results heading to confirm tab is active
    await expect(page.getByRole('heading', { name: /momentum|sma_crossover|rsi_mean_reversion/i })).toBeVisible({ timeout: 10000 });

    // Verify all KPIs are visible (scope to paragraph elements)
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
      await expect(page.getByRole('paragraph').filter({ hasText: kpi })).toBeVisible();
    }
  });

  // Skip: Same AI timing issue - AI may not call backtest tool
  test.skip('equity curve chart renders after backtest', async ({ page }) => {
    const backtestAction = page.locator('button').filter({ hasText: 'Backtest' }).filter({ hasText: 'Run strategy test' });
    await backtestAction.click();

    // Wait for Backtest tab
    await expect(page.locator('.flexlayout__tab_button').filter({ hasText: 'Backtest' })).toBeVisible({ timeout: 90000 });
    await page.locator('.flexlayout__tab_button').filter({ hasText: 'Backtest' }).click();

    // Chart should render (lightweight-charts creates canvas elements)
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10000 });
  });
});
