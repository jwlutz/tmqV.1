import { test, expect } from '@playwright/test';

// Test UI control tools via direct window function calls
// (bypassing AI chat to isolate the window registry fix)

test.describe('UI Control Tools', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5175');
    // Wait for chart to load
    await page.waitForSelector('.flexlayout__tab', { timeout: 10000 });
  });

  test('window.__chartSetSymbol changes chart symbol', async ({ page }) => {
    // Get initial symbol from header (should be BTC-USD by default)
    const symbolInput = page.locator('input[placeholder*="Search"]').first();

    // Call the window function to change symbol
    await page.evaluate(() => {
      const setSymbol = window.__chartSetSymbol?.values().next().value;
      if (setSymbol) {
        setSymbol('ETH-USD');
      }
    });

    // Wait for chart to update
    await page.waitForTimeout(1000);

    // Verify the symbol changed in the UI
    // The chart header should show ETH-USD or the input should have changed
    const symbolText = await page.locator('.text-\\[var\\(--text-primary\\)\\]').first().textContent();

    // The symbol should appear somewhere in the header
    const pageContent = await page.content();
    expect(pageContent).toContain('ETH');
  });

  test('window.__chartSetWidgetType changes widget type', async ({ page }) => {
    // Change to net_liquidity widget
    await page.evaluate(() => {
      const setWidgetType = window.__chartSetWidgetType?.values().next().value;
      if (setWidgetType) {
        setWidgetType('net_liquidity');
      }
    });

    // Wait for widget to update
    await page.waitForTimeout(1000);

    // The widget should now show net liquidity content or dropdown
    const pageContent = await page.content();
    // Net liquidity widget has specific content
    const hasNetLiquidity =
      pageContent.toLowerCase().includes('net liquidity') ||
      pageContent.toLowerCase().includes('liquidity');

    expect(hasNetLiquidity).toBe(true);
  });

  test('window.__flexLayoutAddTab opens new tab', async ({ page }) => {
    // Count initial tabs
    const initialTabs = await page.locator('.flexlayout__tab_button').count();

    // Add a new SEC tab
    await page.evaluate(() => {
      const addTab = (window as { __flexLayoutAddTab?: (type: string) => void }).__flexLayoutAddTab;
      if (addTab) {
        addTab('sec');
      }
    });

    // Wait for tab to appear
    await page.waitForTimeout(500);

    // Should have one more tab
    const newTabs = await page.locator('.flexlayout__tab_button').count();
    expect(newTabs).toBeGreaterThan(initialTabs);
  });

  test('window registry has correct callbacks registered', async ({ page }) => {
    // Check that the window registry is set up correctly
    const registryState = await page.evaluate(() => {
      return {
        hasSymbolMap: !!window.__chartSetSymbol,
        symbolMapSize: window.__chartSetSymbol?.size ?? 0,
        hasWidgetTypeMap: !!window.__chartSetWidgetType,
        widgetTypeMapSize: window.__chartSetWidgetType?.size ?? 0,
        hasActiveChartTabId: !!window.__activeChartTabId,
        hasFlexLayoutAddTab: !!(window as { __flexLayoutAddTab?: unknown }).__flexLayoutAddTab,
      };
    });

    expect(registryState.hasSymbolMap).toBe(true);
    expect(registryState.symbolMapSize).toBeGreaterThan(0);
    expect(registryState.hasWidgetTypeMap).toBe(true);
    expect(registryState.widgetTypeMapSize).toBeGreaterThan(0);
    expect(registryState.hasActiveChartTabId).toBe(true);
    expect(registryState.hasFlexLayoutAddTab).toBe(true);
  });
});
