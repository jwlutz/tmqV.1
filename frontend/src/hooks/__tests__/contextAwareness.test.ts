/**
 * Tests for AI context awareness via window registry.
 * These tests verify that chart tab state is properly exposed
 * for the AI to be aware of what's on screen, WITHOUT making API calls.
 */
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
// Import ChartTabState type and its window augmentation
import type { ChartTabState } from '../../components/workspace/ChartTabContent';
// Side-effect import to get the window type augmentation
import '../../components/workspace/ChartTabContent';
// Import the helper function for testing
import { getActiveChartState } from '../useActiveChartState';

/**
 * Helper to simulate ChartTabContent registering its state.
 * This mirrors the useEffect in ChartTabContent.tsx
 */
function registerChartTab(tabId: string, initialState: ChartTabState) {
  // Initialize maps if needed
  if (!window.__chartSetSymbol) window.__chartSetSymbol = new Map();
  if (!window.__chartSetWidgetType) window.__chartSetWidgetType = new Map();
  if (!window.__chartSetInterval) window.__chartSetInterval = new Map();
  if (!window.__chartGetState) window.__chartGetState = new Map();

  // Track current state via closure (like React's stateRef)
  let currentState = { ...initialState };

  // Register setters
  window.__chartSetSymbol.set(tabId, (symbol: string) => {
    currentState = { ...currentState, symbol };
  });
  window.__chartSetWidgetType.set(tabId, (widgetType: string) => {
    currentState = { ...currentState, widgetType: widgetType as ChartTabState['widgetType'] };
  });
  window.__chartSetInterval.set(tabId, (interval: string) => {
    currentState = { ...currentState, interval };
  });

  // Register getter - returns current state
  window.__chartGetState.set(tabId, () => currentState);

  // Track as active tab
  window.__activeChartTabId = tabId;

  // Return cleanup function
  return () => {
    window.__chartSetSymbol?.delete(tabId);
    window.__chartSetWidgetType?.delete(tabId);
    window.__chartSetInterval?.delete(tabId);
    window.__chartGetState?.delete(tabId);
    if (window.__activeChartTabId === tabId) {
      window.__activeChartTabId = undefined;
    }
  };
}

/**
 * Mirrors getChartContextFromRegistry from useChatWithUIActions.
 * This is the actual function the AI uses to get context.
 */
function getChartContextFromRegistry() {
  const chartPanes: Array<{ id: string; symbol: string; widgetType: string }> = [];
  const activeTabId = window.__activeChartTabId;
  let activePane: { id: string; symbol: string; widgetType: string; interval: string } | undefined;

  window.__chartGetState?.forEach((getState, tabId) => {
    const state = getState();
    const paneInfo = {
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
}

describe('Window Registry for AI Context', () => {
  beforeEach(() => {
    // Clean up window registry before each test
    window.__chartSetSymbol = undefined;
    window.__chartSetWidgetType = undefined;
    window.__chartSetInterval = undefined;
    window.__chartGetState = undefined;
    window.__activeChartTabId = undefined;
  });

  afterEach(() => {
    // Clean up after each test
    window.__chartSetSymbol = undefined;
    window.__chartSetWidgetType = undefined;
    window.__chartSetInterval = undefined;
    window.__chartGetState = undefined;
    window.__activeChartTabId = undefined;
  });

  test('registry is empty when no tabs are registered', () => {
    const context = getChartContextFromRegistry();
    expect(context.chartPanes).toEqual([]);
    expect(context.activePane).toBeUndefined();
  });

  test('single tab registers and exposes state', () => {
    const cleanup = registerChartTab('tab-1', {
      symbol: 'BTC-USD',
      interval: '1d',
      widgetType: 'candlestick',
    });

    const context = getChartContextFromRegistry();

    expect(context.chartPanes).toHaveLength(1);
    expect(context.chartPanes[0]).toEqual({
      id: 'tab-1',
      symbol: 'BTC-USD',
      widgetType: 'candlestick',
    });
    expect(context.activePane).toEqual({
      id: 'tab-1',
      symbol: 'BTC-USD',
      widgetType: 'candlestick',
      interval: '1d',
    });

    cleanup();
  });

  test('multiple tabs register and all are visible', () => {
    const cleanup1 = registerChartTab('tab-1', {
      symbol: 'BTC-USD',
      interval: '1d',
      widgetType: 'candlestick',
    });
    const cleanup2 = registerChartTab('tab-2', {
      symbol: 'ETH-USD',
      interval: '4h',
      widgetType: 'net_liquidity',
    });

    const context = getChartContextFromRegistry();

    expect(context.chartPanes).toHaveLength(2);
    expect(context.chartPanes.map(p => p.symbol)).toContain('BTC-USD');
    expect(context.chartPanes.map(p => p.symbol)).toContain('ETH-USD');

    // Last registered tab becomes active
    expect(context.activePane?.symbol).toBe('ETH-USD');

    cleanup1();
    cleanup2();
  });

  test('state changes are reflected immediately in getter', () => {
    const cleanup = registerChartTab('tab-1', {
      symbol: 'BTC-USD',
      interval: '1d',
      widgetType: 'candlestick',
    });

    // Verify initial state
    let context = getChartContextFromRegistry();
    expect(context.activePane?.symbol).toBe('BTC-USD');

    // Simulate user changing symbol via UI (calls the registered setter)
    window.__chartSetSymbol?.get('tab-1')?.('AAPL');

    // Context should reflect the change immediately
    context = getChartContextFromRegistry();
    expect(context.activePane?.symbol).toBe('AAPL');

    // Change widget type
    window.__chartSetWidgetType?.get('tab-1')?.('yield_curve');
    context = getChartContextFromRegistry();
    expect(context.activePane?.widgetType).toBe('yield_curve');

    // Change interval
    window.__chartSetInterval?.get('tab-1')?.('1h');
    context = getChartContextFromRegistry();
    expect(context.activePane?.interval).toBe('1h');

    cleanup();
  });

  test('cleanup removes tab from registry', () => {
    const cleanup = registerChartTab('tab-1', {
      symbol: 'BTC-USD',
      interval: '1d',
      widgetType: 'candlestick',
    });

    // Verify tab is registered
    expect(getChartContextFromRegistry().chartPanes).toHaveLength(1);

    // Cleanup (simulates component unmount)
    cleanup();

    // Tab should be gone
    expect(getChartContextFromRegistry().chartPanes).toHaveLength(0);
    expect(window.__activeChartTabId).toBeUndefined();
  });

  test('active tab tracking works correctly', () => {
    const cleanup1 = registerChartTab('tab-1', {
      symbol: 'BTC-USD',
      interval: '1d',
      widgetType: 'candlestick',
    });

    expect(window.__activeChartTabId).toBe('tab-1');

    const cleanup2 = registerChartTab('tab-2', {
      symbol: 'ETH-USD',
      interval: '4h',
      widgetType: 'candlestick',
    });

    // Most recently mounted tab is active
    expect(window.__activeChartTabId).toBe('tab-2');

    // Cleanup tab-2, tab-1 is still there but not automatically re-activated
    cleanup2();
    expect(window.__activeChartTabId).toBeUndefined();

    // Tab-1 is still in registry
    expect(getChartContextFromRegistry().chartPanes).toHaveLength(1);
    expect(getChartContextFromRegistry().chartPanes[0].symbol).toBe('BTC-USD');

    cleanup1();
  });
});

describe('Context Getter Function (for useChat)', () => {
  beforeEach(() => {
    window.__chartSetSymbol = undefined;
    window.__chartSetWidgetType = undefined;
    window.__chartSetInterval = undefined;
    window.__chartGetState = undefined;
    window.__activeChartTabId = undefined;
  });

  test('getter returns fresh state each call (no stale closures)', () => {
    const cleanup = registerChartTab('tab-1', {
      symbol: 'BTC-USD',
      interval: '1d',
      widgetType: 'candlestick',
    });

    // Create a "cached" reference to the getter
    const getContext = () => getChartContextFromRegistry();

    // First call
    const context1 = getContext();
    expect(context1.activePane?.symbol).toBe('BTC-USD');

    // Simulate state change
    window.__chartSetSymbol?.get('tab-1')?.('TSLA');

    // Second call - should get fresh state, not cached
    const context2 = getContext();
    expect(context2.activePane?.symbol).toBe('TSLA');

    // Verify they are different objects
    expect(context1).not.toBe(context2);
    expect(context1.activePane?.symbol).toBe('BTC-USD'); // Original unchanged

    cleanup();
  });

  test('handles rapid state changes correctly', () => {
    const cleanup = registerChartTab('tab-1', {
      symbol: 'BTC-USD',
      interval: '1d',
      widgetType: 'candlestick',
    });

    // Rapid changes
    window.__chartSetSymbol?.get('tab-1')?.('ETH-USD');
    window.__chartSetSymbol?.get('tab-1')?.('AAPL');
    window.__chartSetSymbol?.get('tab-1')?.('MSFT');
    window.__chartSetInterval?.get('tab-1')?.('1h');
    window.__chartSetWidgetType?.get('tab-1')?.('net_liquidity');

    // Final state should be the last values
    const context = getChartContextFromRegistry();
    expect(context.activePane?.symbol).toBe('MSFT');
    expect(context.activePane?.interval).toBe('1h');
    expect(context.activePane?.widgetType).toBe('net_liquidity');

    cleanup();
  });
});

describe('Edge Cases', () => {
  beforeEach(() => {
    window.__chartSetSymbol = undefined;
    window.__chartSetWidgetType = undefined;
    window.__chartSetInterval = undefined;
    window.__chartGetState = undefined;
    window.__activeChartTabId = undefined;
  });

  test('handles missing registry gracefully', () => {
    // Don't initialize any registry
    const context = getChartContextFromRegistry();
    expect(context.chartPanes).toEqual([]);
    expect(context.activePane).toBeUndefined();
  });

  test('handles partially initialized registry', () => {
    // Only initialize getState, not setters
    window.__chartGetState = new Map();
    window.__chartGetState.set('orphan-tab', () => ({
      symbol: 'ORPHAN',
      interval: '1d',
      widgetType: 'candlestick' as const,
    }));

    const context = getChartContextFromRegistry();
    expect(context.chartPanes).toHaveLength(1);
    expect(context.chartPanes[0].symbol).toBe('ORPHAN');
    // No active tab since __activeChartTabId not set
    expect(context.activePane).toBeUndefined();
  });

  test('handles tab ID mismatch (active tab not in registry)', () => {
    const cleanup = registerChartTab('tab-1', {
      symbol: 'BTC-USD',
      interval: '1d',
      widgetType: 'candlestick',
    });

    // Manually set active to non-existent tab
    window.__activeChartTabId = 'non-existent-tab';

    const context = getChartContextFromRegistry();
    expect(context.chartPanes).toHaveLength(1);
    // Active pane should be undefined since the ID doesn't match
    expect(context.activePane).toBeUndefined();

    cleanup();
  });
});

describe('getActiveChartState helper (used by CodePanel)', () => {
  beforeEach(() => {
    window.__chartSetSymbol = undefined;
    window.__chartSetWidgetType = undefined;
    window.__chartSetInterval = undefined;
    window.__chartGetState = undefined;
    window.__activeChartTabId = undefined;
  });

  test('returns default state when no registry exists', () => {
    const state = getActiveChartState();
    expect(state.symbol).toBe('BTC-USD');
    expect(state.interval).toBe('1d');
    expect(state.widgetType).toBe('candlestick');
    expect(state.tabId).toBeUndefined();
  });

  test('returns active tab state from registry', () => {
    const cleanup = registerChartTab('my-tab', {
      symbol: 'AAPL',
      interval: '4h',
      widgetType: 'net_liquidity',
    });

    const state = getActiveChartState();
    expect(state.symbol).toBe('AAPL');
    expect(state.interval).toBe('4h');
    expect(state.widgetType).toBe('net_liquidity');
    expect(state.tabId).toBe('my-tab');

    cleanup();
  });

  test('reflects state changes immediately', () => {
    const cleanup = registerChartTab('tab-1', {
      symbol: 'BTC-USD',
      interval: '1d',
      widgetType: 'candlestick',
    });

    // Initial state
    expect(getActiveChartState().symbol).toBe('BTC-USD');

    // Change symbol via setter
    window.__chartSetSymbol?.get('tab-1')?.('MSFT');

    // Should reflect immediately
    expect(getActiveChartState().symbol).toBe('MSFT');

    cleanup();
  });
});
