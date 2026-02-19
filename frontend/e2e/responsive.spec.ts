import { test, expect } from '@playwright/test';

test.describe('Responsive Design', () => {
  test('TopBar shows TMQ on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // TMQ abbreviation visible on mobile
    await expect(page.getByText('TMQ')).toBeVisible();
    // Full name hidden on mobile
    await expect(page.locator('header').getByText('thats_my_quant')).not.toBeVisible();
  });

  test('TopBar shows full name on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Full name visible on desktop
    await expect(page.locator('header').getByText('thats_my_quant')).toBeVisible();
  });

  test('FlexLayout tabs work on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    // Chart tab should be visible
    await expect(page.locator('.flexlayout__tab_button').filter({ hasText: 'Chart' })).toBeVisible({ timeout: 15000 });

    // Chart should render
    await expect(page.locator('.tv-lightweight-charts').first()).toBeVisible({ timeout: 15000 });

    // Click Chat tab
    await page.locator('.flexlayout__tab_button').filter({ hasText: 'Chat' }).click();

    // Welcome message visible
    await expect(page.getByText(/welcome to thats_my_quant/i)).toBeVisible();
  });
});
