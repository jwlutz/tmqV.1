import { test, expect } from '@playwright/test';

test.describe('Chat UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to fully load
    await expect(page.locator('.flexlayout__tab_button').filter({ hasText: 'Chart' })).toBeVisible({ timeout: 15000 });
    // Navigate to Chat tab
    await page.locator('.flexlayout__tab_button').filter({ hasText: 'Chat' }).click();
    // Wait for chat content to be ready
    await expect(page.getByText(/welcome to thats_my_quant/i)).toBeVisible({ timeout: 10000 });
  });

  test('shows welcome message', async ({ page }) => {
    // Welcome message should be visible (already checked in beforeEach but verify content)
    await expect(page.getByText(/help you backtest|trading strategies/i)).toBeVisible();
  });

  test('shows quick action examples', async ({ page }) => {
    // Quick actions section should be visible
    await expect(page.getByText('Examples')).toBeVisible();

    // Should have the 4 quick action buttons
    await expect(page.locator('button').filter({ hasText: 'Backtest' }).first()).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'Stats' }).first()).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'Explain' }).first()).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'Optimize' }).first()).toBeVisible();
  });

  test('chat input is visible and functional', async ({ page }) => {
    // Find the chat input by aria-label
    const input = page.getByRole('textbox', { name: /chat message/i });
    await expect(input).toBeVisible();

    // Should be able to type in it
    await input.fill('test message');
    await expect(input).toHaveValue('test message');
  });

  test('quick action click sends message', async ({ page }) => {
    // Click the Backtest quick action
    const quickAction = page.locator('button').filter({ hasText: 'Backtest' }).first();
    await quickAction.click();

    // The message sent by quick action should appear in the messages area (not quick actions)
    const messagesArea = page.locator('.overflow-y-auto');
    await expect(messagesArea.getByText(/Run a momentum backtest/i)).toBeVisible({ timeout: 5000 });
  });

  test('user message appears in chat', async ({ page }) => {
    // Find the input by aria-label
    const input = page.getByRole('textbox', { name: /chat message/i });
    await input.fill('Hello AI');
    await input.press('Enter');

    // User message should appear in the chat
    await expect(page.getByText('Hello AI')).toBeVisible({ timeout: 5000 });
  });
});

// Tests that require AI API keys
test.describe('Chat AI Integration', () => {
  // Run AI tests serially to avoid rate limits
  test.describe.configure({ mode: 'serial' });
  // Skip if no API key is configured
  test.skip(({ }, testInfo) => !process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY, 'Requires AI API key');

  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure clean state and force provider auto-selection
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Wait for app to fully load and server config to be fetched
    await expect(page.locator('.flexlayout__tab_button').filter({ hasText: 'Chart' })).toBeVisible({ timeout: 15000 });

    // Navigate to Chat tab
    await page.locator('.flexlayout__tab_button').filter({ hasText: 'Chat' }).click();
    await expect(page.getByText(/welcome to thats_my_quant/i)).toBeVisible({ timeout: 10000 });

    // Wait for server config to be fetched and provider to be auto-selected
    await page.waitForTimeout(1500);
  });

  // Skip: AI responds too quickly for stop button to be reliably caught
  // The stop button exists (aria-label="Stop generation") but timing is unpredictable
  test.skip('quick actions are disabled during AI response', async ({ page }) => {
    const input = page.getByRole('textbox', { name: /chat message/i });
    await input.fill('Tell me a very long story about trading');
    await input.press('Enter');

    // Wait for the stop button to appear (indicates AI is generating)
    await expect(page.getByRole('button', { name: /stop generation/i })).toBeVisible({ timeout: 10000 });

    // Now check that quick actions are disabled
    const quickAction = page.locator('button').filter({ hasText: 'Backtest' }).first();
    const isDisabled = await quickAction.isDisabled();
    expect(isDisabled).toBeTruthy();
  });

  // Skip: AI responds too quickly for stop button to be reliably caught
  test.skip('stop button appears during AI generation', async ({ page }) => {
    const input = page.getByRole('textbox', { name: /chat message/i });
    await input.fill('Write me a detailed analysis of momentum trading strategies');
    await input.press('Enter');

    // Stop button should appear during generation
    await expect(page.getByRole('button', { name: /stop generation/i })).toBeVisible({ timeout: 10000 });
  });

  test('AI responds to messages', async ({ page }) => {
    const input = page.getByRole('textbox', { name: /chat message/i });
    await input.fill('What is 2+2?');
    await input.press('Enter');

    // Wait for AI response (should mention 4 or "four")
    await expect(page.getByText(/4|four/i).last()).toBeVisible({ timeout: 60000 });
  });
});
