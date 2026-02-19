import { test, expect } from '@playwright/test';

test.describe('SEC Filings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to load
    await expect(page.locator('.tv-lightweight-charts').first()).toBeVisible({ timeout: 15000 });
  });

  test('should open SEC tab via window function', async ({ page }) => {
    // Use the exposed addTab function to open SEC tab
    await page.evaluate(() => {
      (window as any).__flexLayoutAddTab('sec');
    });

    // SEC pane should appear with symbol input
    await expect(page.getByPlaceholder('TICKER')).toBeVisible({ timeout: 5000 });

    // Default symbol should be AAPL
    await expect(page.getByPlaceholder('TICKER')).toHaveValue('AAPL');
  });

  test('should load filings list for default symbol', async ({ page }) => {
    // Open SEC tab
    await page.evaluate(() => {
      (window as any).__flexLayoutAddTab('sec');
    });

    // Wait for filings to load (SEC API can be slow)
    // Use exact match for header column text
    await expect(page.getByText('Form', { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Description', { exact: true })).toBeVisible();

    // Should show at least one filing (AAPL has many)
    // Look for common form types
    const filingRow = page.locator('[class*="grid"][class*="cursor-pointer"]').first();
    await expect(filingRow).toBeVisible({ timeout: 30000 });
  });

  test('should switch between All and Insider views', async ({ page }) => {
    // Open SEC tab
    await page.evaluate(() => {
      (window as any).__flexLayoutAddTab('sec');
    });

    // Wait for initial load
    await expect(page.getByText('Form', { exact: true })).toBeVisible({ timeout: 30000 });

    // Click Insider tab
    await page.getByRole('button', { name: /insider/i }).click();

    // Wait for insider data to load - the "Form" header should disappear
    // and insider-specific content should appear (loading spinner or data)
    await expect(page.getByText('Form', { exact: true })).not.toBeVisible({ timeout: 10000 });

    // Switch back to All
    await page.getByRole('button', { name: /^all$/i }).click();
    await expect(page.getByText('Form', { exact: true })).toBeVisible({ timeout: 30000 });
  });

  test('should change symbol via input', async ({ page }) => {
    // Open SEC tab
    await page.evaluate(() => {
      (window as any).__flexLayoutAddTab('sec');
    });

    // Wait for initial load
    await expect(page.getByPlaceholder('TICKER')).toBeVisible({ timeout: 5000 });

    // Change to MSFT
    const input = page.getByPlaceholder('TICKER');
    await input.clear();
    await input.fill('MSFT');
    await page.getByRole('button', { name: /^go$/i }).click();

    // Wait for new filings to load
    await expect(page.getByText('Form', { exact: true })).toBeVisible({ timeout: 30000 });
  });

  test('should show popular tickers dropdown on focus', async ({ page }) => {
    // Open SEC tab
    await page.evaluate(() => {
      (window as any).__flexLayoutAddTab('sec');
    });

    // Focus the input
    const input = page.getByPlaceholder('TICKER');
    await input.focus();

    // Dropdown should show popular tickers
    await expect(page.getByText('Popular')).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('button', { name: 'AAPL' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'MSFT' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'GOOGL' })).toBeVisible();
  });

  test('should show filter panel in filings view', async ({ page }) => {
    // Open SEC tab
    await page.evaluate(() => {
      (window as any).__flexLayoutAddTab('sec');
    });

    // Wait for initial load
    await expect(page.getByText('Form', { exact: true })).toBeVisible({ timeout: 30000 });

    // Click Filter button
    await page.getByRole('button', { name: /filter/i }).click();

    // Filter panel should show form categories
    await expect(page.getByText('Insider:')).toBeVisible();
    await expect(page.getByText('Annual/Qtr:')).toBeVisible();
    await expect(page.getByText('Current:')).toBeVisible();
  });

  test('should open filing detail view on click', async ({ page }) => {
    // Open SEC tab
    await page.evaluate(() => {
      (window as any).__flexLayoutAddTab('sec');
    });

    // Wait for filings to load
    await expect(page.getByText('Form', { exact: true })).toBeVisible({ timeout: 30000 });

    // Click the first filing row
    const filingRow = page.locator('[class*="grid"][class*="cursor-pointer"]').first();
    await filingRow.click();

    // Detail view should show Back button and SEC.gov link
    await expect(page.getByRole('button', { name: /back/i })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('link', { name: /sec\.gov/i })).toBeVisible();
  });
});
