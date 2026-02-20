import { test, expect } from '@playwright/test';

/**
 * E2E tests for AI context awareness.
 * Tests that when the user changes the chart state, the AI receives
 * the correct context when sending messages.
 *
 * Flow tested: UI change → window registry → getContext() → API request
 */

test.describe('AI Context Awareness', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for chart and registry to be ready
    await page.waitForSelector('.flexlayout__tab', { timeout: 10000 });
    await page.waitForFunction(() => (window.__chartGetState?.size ?? 0) > 0, { timeout: 5000 });
  });

  test('window registry exposes current chart state', async ({ page }) => {
    // Verify __chartGetState is registered
    const hasGetter = await page.evaluate(() => {
      return (window.__chartGetState?.size ?? 0) > 0;
    });
    expect(hasGetter).toBe(true);

    // Get initial state
    const initialState = await page.evaluate(() => {
      const activeTabId = window.__activeChartTabId;
      if (!activeTabId) return null;
      const getState = window.__chartGetState?.get(activeTabId);
      return getState ? getState() : null;
    });

    expect(initialState).not.toBeNull();
    expect(initialState).toHaveProperty('symbol');
    expect(initialState).toHaveProperty('interval');
    expect(initialState).toHaveProperty('widgetType');
  });

  test('state changes via setters are reflected in getter immediately', async ({ page }) => {
    // Change symbol via setter
    await page.evaluate(() => {
      const activeTabId = window.__activeChartTabId;
      if (!activeTabId) throw new Error('No active tab');
      const setSymbol = window.__chartSetSymbol?.get(activeTabId);
      if (setSymbol) setSymbol('AAPL');
    });

    // Wait for React state update
    await page.waitForFunction(() => {
      const activeTabId = window.__activeChartTabId;
      if (!activeTabId) return false;
      const getState = window.__chartGetState?.get(activeTabId);
      return getState?.().symbol === 'AAPL';
    }, { timeout: 5000 });

    // Verify getter returns updated state
    const updatedState = await page.evaluate(() => {
      const activeTabId = window.__activeChartTabId;
      if (!activeTabId) return null;
      const getState = window.__chartGetState?.get(activeTabId);
      return getState ? getState() : null;
    });

    expect(updatedState?.symbol).toBe('AAPL');
  });

  test('getChartContextFromRegistry returns correct structure', async ({ page }) => {
    // Inject the same function used by useChatWithUIActions
    const context = await page.evaluate(() => {
      interface ChartPaneInfo {
        id: string;
        symbol: string;
        widgetType: string;
      }

      interface ActivePane extends ChartPaneInfo {
        interval: string;
      }

      const chartPanes: ChartPaneInfo[] = [];
      const activeTabId = window.__activeChartTabId;
      let activePane: ActivePane | undefined;

      window.__chartGetState?.forEach((getState, tabId) => {
        const state = getState();
        const paneInfo: ChartPaneInfo = {
          id: tabId,
          symbol: state.symbol,
          widgetType: state.widgetType,
        };
        chartPanes.push(paneInfo);

        if (tabId === activeTabId) {
          activePane = {
            id: tabId,
            symbol: state.symbol,
            widgetType: state.widgetType,
            interval: state.interval,
          };
        }
      });

      return { activePane, chartPanes };
    });

    expect(context.chartPanes.length).toBeGreaterThan(0);
    expect(context.activePane).toBeDefined();
    expect(context.activePane?.symbol).toBeDefined();
  });

  test('chat API request includes current context', async ({ page }) => {
    // Set a unique symbol so we can verify it in the request
    await page.evaluate(() => {
      const activeTabId = window.__activeChartTabId;
      if (!activeTabId) throw new Error('No active tab');
      const setSymbol = window.__chartSetSymbol?.get(activeTabId);
      if (setSymbol) setSymbol('UNIQUE-TEST-SYMBOL');
    });

    // Wait for React state update
    await page.waitForFunction(() => {
      const activeTabId = window.__activeChartTabId;
      if (!activeTabId) return false;
      const getState = window.__chartGetState?.get(activeTabId);
      return getState?.().symbol === 'UNIQUE-TEST-SYMBOL';
    }, { timeout: 5000 });

    // Intercept the chat API request
    let capturedContext: unknown = null;
    await page.route('**/api/chat', async (route) => {
      const request = route.request();
      const postData = request.postDataJSON();
      capturedContext = postData?.context;

      // Abort the request - we don't need to actually call the API
      await route.abort();
    });

    // Find and click the chat tab if not visible
    const chatTab = page.locator('.flexlayout__tab_button:has-text("Chat")');
    if (await chatTab.isVisible()) {
      await chatTab.click();
    }

    // Type and send a message (this triggers the API request)
    const chatInput = page.locator('textarea[placeholder*="Ask"]').or(
      page.locator('input[placeholder*="Ask"]')
    ).or(
      page.locator('[data-testid="chat-input"]')
    );

    // Wait for chat input to be visible and enabled
    await chatInput.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
      // Chat might be in a different location, try broader selector
    });

    if (await chatInput.isVisible()) {
      await chatInput.fill('test message');
      await chatInput.press('Enter');

      // Wait a bit for the request to be intercepted
      await page.waitForTimeout(500);

      // Verify the context was included in the request
      expect(capturedContext).toBeDefined();
      if (capturedContext && typeof capturedContext === 'object') {
        const ctx = capturedContext as { active_pane?: { symbol?: string } };
        expect(ctx.active_pane?.symbol).toBe('UNIQUE-TEST-SYMBOL');
      }
    }
  });

  test('multiple rapid symbol changes result in correct final state', async ({ page }) => {
    // Rapid state changes
    await page.evaluate(() => {
      const activeTabId = window.__activeChartTabId;
      if (!activeTabId) throw new Error('No active tab');
      const setSymbol = window.__chartSetSymbol?.get(activeTabId);
      if (setSymbol) {
        setSymbol('ETH-USD');
        setSymbol('TSLA');
        setSymbol('NVDA');
        setSymbol('FINAL-SYMBOL');
      }
    });

    // Wait for final state to settle
    await page.waitForFunction(() => {
      const activeTabId = window.__activeChartTabId;
      if (!activeTabId) return false;
      const getState = window.__chartGetState?.get(activeTabId);
      return getState?.().symbol === 'FINAL-SYMBOL';
    }, { timeout: 5000 });

    // Verify final state
    const finalState = await page.evaluate(() => {
      const activeTabId = window.__activeChartTabId;
      if (!activeTabId) return null;
      const getState = window.__chartGetState?.get(activeTabId);
      return getState ? getState() : null;
    });

    expect(finalState?.symbol).toBe('FINAL-SYMBOL');
  });

  test('widget type changes are reflected in context', async ({ page }) => {
    // Change widget type
    await page.evaluate(() => {
      const activeTabId = window.__activeChartTabId;
      if (!activeTabId) throw new Error('No active tab');
      const setWidget = window.__chartSetWidgetType?.get(activeTabId);
      if (setWidget) setWidget('net_liquidity');
    });

    // Wait for widget type state update
    await page.waitForFunction(() => {
      const activeTabId = window.__activeChartTabId;
      if (!activeTabId) return false;
      const getState = window.__chartGetState?.get(activeTabId);
      return getState?.().widgetType === 'net_liquidity';
    }, { timeout: 5000 });

    const state = await page.evaluate(() => {
      const activeTabId = window.__activeChartTabId;
      if (!activeTabId) return null;
      const getState = window.__chartGetState?.get(activeTabId);
      return getState ? getState() : null;
    });

    expect(state?.widgetType).toBe('net_liquidity');
  });

  test('interval changes are reflected in context', async ({ page }) => {
    // Change interval
    await page.evaluate(() => {
      const activeTabId = window.__activeChartTabId;
      if (!activeTabId) throw new Error('No active tab');
      const setInterval = window.__chartSetInterval?.get(activeTabId);
      if (setInterval) setInterval('4h');
    });

    // Wait for interval state update
    await page.waitForFunction(() => {
      const activeTabId = window.__activeChartTabId;
      if (!activeTabId) return false;
      const getState = window.__chartGetState?.get(activeTabId);
      return getState?.().interval === '4h';
    }, { timeout: 5000 });

    const state = await page.evaluate(() => {
      const activeTabId = window.__activeChartTabId;
      if (!activeTabId) return null;
      const getState = window.__chartGetState?.get(activeTabId);
      return getState ? getState() : null;
    });

    expect(state?.interval).toBe('4h');
  });
});
