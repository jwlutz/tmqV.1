import { test, expect } from '@playwright/test';

test.describe('Chat', () => {
  test('should send and receive messages', async ({ page }) => {
    await page.goto('/');

    // Welcome message should be visible
    await expect(page.getByText(/welcome to thats_my_quant/i)).toBeVisible();

    // Type and send a message
    const input = page.getByRole('textbox', { name: /chat message/i });
    await input.fill('Hello, can you help me?');
    await input.press('Enter');

    // User message should appear
    await expect(page.getByText('Hello, can you help me?')).toBeVisible();

    // Wait for response (mock response delay up to 3s)
    await expect(page.getByText(/I understand you're asking/i)).toBeVisible({ timeout: 5000 });
  });

  test('quick actions trigger chat messages', async ({ page }) => {
    await page.goto('/');

    // Click the "Stats" quick action (avoid conflict with TopBar "Backtest" button)
    await page.getByRole('button', { name: /stats/i }).click();

    // Response should include stats table
    await expect(page.getByText(/Performance Statistics/i)).toBeVisible({ timeout: 5000 });
  });

  test('quick actions are disabled while typing', async ({ page }) => {
    await page.goto('/');

    // Send a message
    const input = page.getByRole('textbox', { name: /chat message/i });
    await input.fill('test');
    await input.press('Enter');

    // Quick action buttons should be disabled during response
    const statsAction = page.getByRole('button', { name: /stats/i });
    await expect(statsAction).toBeDisabled();

    // Wait for response to complete, then should be enabled
    await expect(statsAction).toBeEnabled({ timeout: 5000 });
  });
});
