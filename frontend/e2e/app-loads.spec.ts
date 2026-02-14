import { test, expect } from '@playwright/test';

test.describe('App Loading', () => {
  test('should load with live chart visible', async ({ page }) => {
    await page.goto('/');

    // TopBar visible
    await expect(page.locator('header')).toBeVisible();

    // Mode toggle visible with Live active
    const liveButton = page.locator('header').getByRole('button', { name: /live/i });
    await expect(liveButton).toBeVisible();

    // Chart container visible (use first() since backtest also creates one)
    await expect(page.locator('.tv-lightweight-charts').first()).toBeVisible({ timeout: 15000 });

    // Chat sidebar visible
    await expect(page.getByText('Chat')).toBeVisible();

    // Quick actions visible
    await expect(page.getByText('Quick Actions')).toBeVisible();
  });

  test('should show welcome message in chat', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText(/welcome to thats_my_quant/i)).toBeVisible();
  });
});
