/**
 * Hook to read the active chart's state from the window registry.
 * This is the single source of truth for chart state, replacing
 * AppContext panes which could become stale.
 *
 * Use this instead of useChartLayout().panes for getting current chart state.
 */

import type { ChartTabState } from '../components/workspace/ChartTabContent';

export interface ActiveChartState {
  /** Symbol of the active/focused chart tab */
  symbol: string;
  /** Interval of the active chart tab */
  interval: string;
  /** Widget type of the active chart tab */
  widgetType: string;
  /** ID of the active chart tab */
  tabId: string | undefined;
}

const DEFAULT_STATE: ActiveChartState = {
  symbol: 'BTC-USD',
  interval: '1d',
  widgetType: 'candlestick',
  tabId: undefined,
};

/**
 * Get the active chart state from the window registry.
 * This reads directly from ChartTabContent's registered state.
 */
export function getActiveChartState(): ActiveChartState {
  const activeTabId = window.__activeChartTabId;
  if (!activeTabId) {
    return DEFAULT_STATE;
  }

  const getState = window.__chartGetState?.get(activeTabId);
  if (!getState) {
    return DEFAULT_STATE;
  }

  const state = getState();
  return {
    symbol: state.symbol,
    interval: state.interval,
    widgetType: state.widgetType,
    tabId: activeTabId,
  };
}

/**
 * Get all visible chart panes from the window registry.
 */
export function getAllChartPanes(): Array<{ id: string } & ChartTabState> {
  const panes: Array<{ id: string } & ChartTabState> = [];

  window.__chartGetState?.forEach((getState, tabId) => {
    const state = getState();
    panes.push({
      id: tabId,
      ...state,
    });
  });

  return panes;
}
