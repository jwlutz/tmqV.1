import { test, expect } from '@playwright/test';

test.describe('App Loading', () => {
  test('should load with chart tab visible', async ({ page }) => {
    await page.goto('/');

    // TopBar visible with app name (use header-scoped selector)
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('header').getByText('thats_my_quant')).toBeVisible();

    // FlexLayout tabs should be visible (Chart, Chat, Code are default)
    await expect(page.locator('.flexlayout__tab_button').filter({ hasText: 'Chart' })).toBeVisible({ timeout: 15000 });

    // Chart container visible (lightweight-charts)
    await expect(page.locator('.tv-lightweight-charts').first()).toBeVisible({ timeout: 15000 });
  });

  test('should have Chat tab with welcome message', async ({ page }) => {
    await page.goto('/');

    // Click the Chat tab
    await page.locator('.flexlayout__tab_button').filter({ hasText: 'Chat' }).click();

    // Welcome message should be visible
    await expect(page.getByText(/welcome to thats_my_quant/i)).toBeVisible();

    // Examples (Quick Actions) should be visible
    await expect(page.getByText('Examples')).toBeVisible();
  });

  test('should have Add dropdown to create new tabs', async ({ page }) => {
    await page.goto('/');

    // Find and click the Add button in header
    const addButton = page.locator('header button').filter({ hasText: /add/i });
    await expect(addButton).toBeVisible();
    await addButton.click();

    // Dropdown should show tab options (scope to the dropdown menu)
    const dropdown = page.locator('[class*="absolute"][class*="rounded-lg"]');
    await expect(dropdown.getByRole('button', { name: /📈.*Chart/ })).toBeVisible();
    await expect(dropdown.getByRole('button', { name: /💬.*Chat/ })).toBeVisible();
    await expect(dropdown.getByRole('button', { name: /💻.*Code/ })).toBeVisible();
    await expect(dropdown.getByRole('button', { name: /📊.*Backtest/ })).toBeVisible();
    await expect(dropdown.getByRole('button', { name: /🧠.*Rot/ })).toBeVisible();
  });
});
