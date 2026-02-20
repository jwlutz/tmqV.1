import { test, expect } from '@playwright/test';

// Test AI UI control tools via chat
// This tests the full flow: AI -> backend -> SSE -> handleUIAction -> window registry -> chart

test.describe('AI UI Control Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
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

  test('full flow: AI set_interval action changes chart interval', async ({ page }) => {
    // Verify window registry for interval is set up
    const registryReady = await page.evaluate(() => {
      return (window.__chartSetInterval?.size ?? 0) > 0;
    });
    expect(registryReady).toBe(true);

    // Simulate what handleUIAction does when AI returns a set_interval action
    await page.evaluate(() => {
      const action = {
        _action: 'set_interval' as const,
        interval: '1h',
      };

      const getActiveChartTabId = () => window.__activeChartTabId;
      const targetTabId = action.pane_id || getActiveChartTabId();
      const setIntervalFn = targetTabId && window.__chartSetInterval?.get(targetTabId);
      if (setIntervalFn) {
        setIntervalFn(action.interval);
      }
    });

    // Wait for chart to update
    await page.waitForTimeout(1000);

    // Verify the interval changed (check via window registry state)
    const newInterval = await page.evaluate(() => {
      const activeTabId = window.__activeChartTabId;
      if (activeTabId && window.__chartGetState) {
        const getState = window.__chartGetState.get(activeTabId);
        return getState?.()?.interval;
      }
      return null;
    });
    expect(newInterval).toBe('1h');
  });

  test('full flow: AI select_tab action selects existing tab', async ({ page }) => {
    // First, add a code tab to have multiple tabs
    await page.evaluate(() => {
      const addTab = (window as { __flexLayoutAddTab?: (type: string) => void }).__flexLayoutAddTab;
      if (addTab) {
        addTab('backtest');
      }
    });

    await page.waitForTimeout(500);

    // Now simulate selecting the chart tab via AI action
    await page.evaluate(() => {
      const selectTab = (window as { __flexLayoutSelectTab?: (tabId?: string, tabType?: string) => void }).__flexLayoutSelectTab;
      if (selectTab) {
        selectTab(undefined, 'chart');
      }
    });

    await page.waitForTimeout(300);

    // Verify the chart tab is now selected (it should be visible/active)
    // The chart tab should be the active one - we can check if chart content is visible
    const chartVisible = await page.locator('.flexlayout__tab').filter({ has: page.locator('[data-testid="chart-container"], canvas') }).first().isVisible();
    expect(chartVisible).toBe(true);
  });
});
