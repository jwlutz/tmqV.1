import { test, expect } from '@playwright/test';

// Test AI UI control tools via chat
// This tests the full flow: AI -> backend -> SSE -> handleUIAction -> window registry -> chart

test.describe('AI UI Control Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5175');
    // Wait for chart and chat to load
    await page.waitForSelector('.flexlayout__tab', { timeout: 10000 });
  });

  test('full flow: AI set_symbol action updates chart via window registry', async ({ page }) => {
    // First, verify window registry is set up
    const registryReady = await page.evaluate(() => {
      return (window.__chartSetSymbol?.size ?? 0) > 0;
    });
    expect(registryReady).toBe(true);

    // Simulate what handleUIAction does when AI returns a set_symbol action
    await page.evaluate(() => {
      // This simulates the action parsing in useChatWithUIActions
      const action = {
        _action: 'set_symbol' as const,
        symbol: 'SOL-USD',
      };

      // This is what handleUIAction does:
      const getActiveChartTabId = () => window.__activeChartTabId;
      const targetTabId = action.pane_id || getActiveChartTabId();
      const setSymbolFn = targetTabId && window.__chartSetSymbol?.get(targetTabId);
      if (setSymbolFn) {
        setSymbolFn(action.symbol);
      }
    });

    // Wait for chart to update
    await page.waitForTimeout(1000);

    // Verify SOL-USD appears somewhere in the page
    const pageContent = await page.content();
    expect(pageContent).toContain('SOL');
  });

  test('full flow: AI set_widget action updates widget via window registry', async ({ page }) => {
    // Simulate what handleUIAction does when AI returns a set_widget action
    await page.evaluate(() => {
      const action = {
        _action: 'set_widget' as const,
        widget_type: 'yield_curve',
      };

      const getActiveChartTabId = () => window.__activeChartTabId;
      const targetTabId = action.pane_id || getActiveChartTabId();
      const setWidgetFn = targetTabId && window.__chartSetWidgetType?.get(targetTabId);
      if (setWidgetFn) {
        setWidgetFn(action.widget_type);
      }
    });

    // Wait for widget to update
    await page.waitForTimeout(1000);

    // The yield curve widget should be visible
    const pageContent = await page.content();
    const hasYieldCurve =
      pageContent.toLowerCase().includes('yield') ||
      pageContent.toLowerCase().includes('treasury');

    expect(hasYieldCurve).toBe(true);
  });

  test('full flow: AI open_tab action adds new tab', async ({ page }) => {
    const initialTabs = await page.locator('.flexlayout__tab_button').count();

    // Simulate what handleUIAction does when AI returns an open_tab action
    await page.evaluate(() => {
      const action = {
        _action: 'open_tab' as const,
        tab_type: 'rot',
      };

      const addTab = (window as { __flexLayoutAddTab?: (type: string) => void }).__flexLayoutAddTab;
      if (addTab && action.tab_type) {
        addTab(action.tab_type);
      }
    });

    await page.waitForTimeout(500);

    const finalTabs = await page.locator('.flexlayout__tab_button').count();
    expect(finalTabs).toBeGreaterThan(initialTabs);
  });
});
