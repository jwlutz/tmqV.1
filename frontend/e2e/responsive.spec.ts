import { test, expect } from '@playwright/test';

test.describe('Responsive Design', () => {
  test('mobile layout shows FAB and can toggle sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // FAB should be visible
    const fab = page.getByRole('button', { name: /toggle chat/i });
    await expect(fab).toBeVisible();

    // Sidebar starts open on initial render
    const sidebar = page.locator('[class*="w-\\[350px\\]"]');
    await expect(sidebar).toBeVisible();

    // Click FAB to close sidebar (toggles isOpen to false)
    await fab.click();

    // Wait for transition, then sidebar should be translated off-screen
    await page.waitForTimeout(400);
    await expect(sidebar).toHaveClass(/translate-x-full/);

    // Click FAB again to reopen
    await fab.click();
    await page.waitForTimeout(400);
    await expect(sidebar).toHaveClass(/translate-x-0/);
  });

  test('TopBar shows TMQ on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    await expect(page.getByText('TMQ')).toBeVisible();
  });

  test('KPIs display on tablet in backtest mode', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    await page.locator('header').getByRole('button', { name: /backtest/i }).click({ force: true });

    await expect(page.getByText('Sharpe Ratio')).toBeVisible();
    await expect(page.getByText('Win Rate')).toBeVisible();
  });
});
