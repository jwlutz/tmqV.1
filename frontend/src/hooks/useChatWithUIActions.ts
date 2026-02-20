import { useCallback, useRef } from 'react';
import { useBacktest, useChatSettings, useCodePanel, useChartLayout } from '../context';
import { useActionConfirmation } from '../context/ActionConfirmationContext';
import { useChat } from './useChat';
import { ChatContext, UIAction, ChartPaneInfo } from '../api/client';
import type { WidgetType } from '../widgets/types';
import type { ChartLayout } from '../context';

// Default models for each provider (must match litellm model names)
const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
  google: 'gemini-2.0-flash',
  xai: 'grok-2',
  openrouter: 'anthropic/claude-haiku-4.5',
};

/**
 * Reads chart tab state from window registry for AI context awareness.
 * This is called at message-send time to get fresh state.
 */
function getChartContextFromRegistry(layout: ChartLayout, codePanelOpen: boolean): ChatContext {
  const chartPanes: ChartPaneInfo[] = [];
  const activeTabId = window.__activeChartTabId;
  let activePaneInfo: ChatContext['activePane'] = undefined;

  // Read from window registry for live chart tab state
  window.__chartGetState?.forEach((getState, tabId) => {
    const state = getState();
    const paneInfo: ChartPaneInfo = {
      id: tabId,
      symbol: state.symbol,
      widgetType: state.widgetType,
    };
    chartPanes.push(paneInfo);

    if (tabId === activeTabId) {
      activePaneInfo = {
        id: tabId,
        symbol: state.symbol,
        widgetType: state.widgetType,
        interval: state.interval,
      };
    }
  });

  return {
    activePane: activePaneInfo,
    chartPanes,
    workspace: { layout, codePanelOpen },
  };
}

/**
 * Shared hook that combines useChat with UI action handling and workspace context.
 * Used by both ChatSidebar and ChatPaneContent to avoid code duplication.
 */
export function useChatWithUIActions() {
  const { setBacktestResult } = useBacktest();
  const {
    apiKey, model,
    useOpenRouter, openRouterApiKey, openRouterModel,
    selectedServerProvider
  } = useChatSettings();
  const { requestConfirmation } = useActionConfirmation();

  // Get workspace state for AI context (layout is from AppContext, chart state from window registry)
  const { layout } = useChartLayout();
  const { codePanelOpen, setCodePanelOpen, setSandboxCode } = useCodePanel();

  // Create stable refs for values used in getter function
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const codePanelOpenRef = useRef(codePanelOpen);
  codePanelOpenRef.current = codePanelOpen;

  // Context getter function - called at message-send time for fresh state
  const getContext = useCallback((): ChatContext => {
    return getChartContextFromRegistry(layoutRef.current, codePanelOpenRef.current);
  }, []);

  // Compute effective API key and model based on provider selection
  const effectiveApiKey = useOpenRouter ? openRouterApiKey : apiKey;
  const effectiveUseOpenRouter = selectedServerProvider === 'openrouter' || useOpenRouter;
  const effectiveModel = effectiveUseOpenRouter
    ? openRouterModel
    : (selectedServerProvider
        ? PROVIDER_DEFAULT_MODELS[selectedServerProvider] || model
        : model);

  const handleCustomCode = useCallback((code: string) => {
    setSandboxCode(code);
    setCodePanelOpen(true);
  }, [setSandboxCode, setCodePanelOpen]);

  // Handle UI actions from AI (widget changes, layout changes, etc.)
  const handleUIAction = useCallback((action: UIAction) => {
    console.log('[handleUIAction] Received action:', action._action, action);

    // Helper to get active chart tab ID (FlexLayout tab, not AppContext pane)
    const getActiveChartTabId = () => window.__activeChartTabId;

    switch (action._action) {
      case 'set_widget':
        if (action.widget_type) {
          // Use FlexLayout chart tab registry
          const targetTabId = action.pane_id || getActiveChartTabId();
          const setWidgetFn = targetTabId && window.__chartSetWidgetType?.get(targetTabId);
          if (setWidgetFn) {
            setWidgetFn(action.widget_type as WidgetType);
          } else {
            // Fallback: try first available chart tab
            const firstEntry = window.__chartSetWidgetType?.entries().next().value;
            if (firstEntry) firstEntry[1](action.widget_type as WidgetType);
          }
        }
        break;
      case 'set_layout':
        {
          // Use FlexLayout window functions instead of AppContext
          const applyPreset = (window as unknown as { __flexLayoutApplyPreset?: (preset: string) => boolean }).__flexLayoutApplyPreset;
          const setLayoutFn = (window as unknown as { __flexLayoutSetLayout?: (layout: string) => boolean }).__flexLayoutSetLayout;

          if (action.preset && applyPreset) {
            applyPreset(action.preset);
          } else if (action.layout && setLayoutFn) {
            setLayoutFn(action.layout);
          }
        }
        break;
      case 'set_symbol':
        if (action.symbol) {
          // Use FlexLayout chart tab registry
          const targetTabId = action.pane_id || getActiveChartTabId();
          const setSymbolFn = targetTabId && window.__chartSetSymbol?.get(targetTabId);
          if (setSymbolFn) {
            setSymbolFn(action.symbol);
          } else {
            // Fallback: try first available chart tab
            const firstEntry = window.__chartSetSymbol?.entries().next().value;
            if (firstEntry) firstEntry[1](action.symbol);
          }
        }
        break;
      case 'toggle_code_panel':
        if (action.open !== undefined) {
          setCodePanelOpen(action.open);
        } else {
          setCodePanelOpen(!codePanelOpen);
        }
        break;
      case 'open_tab':
        if (action.tab_type) {
          // Use the exposed flexlayout addTab function
          const addTab = (window as unknown as { __flexLayoutAddTab?: (type: string) => void }).__flexLayoutAddTab;
          if (addTab) {
            addTab(action.tab_type);
          }
        }
        break;
      case 'set_interval':
        if (action.interval) {
          // Use FlexLayout chart tab registry
          const targetTabId = action.pane_id || getActiveChartTabId();
          const setIntervalFn = targetTabId && window.__chartSetInterval?.get(targetTabId);
          if (setIntervalFn) {
            setIntervalFn(action.interval);
          } else {
            // Fallback: try first available chart tab
            const firstEntry = window.__chartSetInterval?.entries().next().value;
            if (firstEntry) firstEntry[1](action.interval);
          }
        }
        break;
      case 'select_tab':
        {
          // Use the exposed flexlayout selectTab function
          const selectTab = (window as unknown as { __flexLayoutSelectTab?: (tabId?: string, tabType?: string) => void }).__flexLayoutSelectTab;
          if (selectTab) {
            selectTab(action.tab_id, action.tab_type);
          }
        }
        break;
      case 'apply_indicator':
        if (action.indicator) {
          // Use FlexLayout chart tab registry
          const targetTabId = action.pane_id || getActiveChartTabId();
          // Special case: volume toggle
          if (action.indicator === 'volume') {
            const toggleVolume = targetTabId && window.__chartVolumeToggle?.get(targetTabId);
            if (toggleVolume) {
              toggleVolume();
            }
          } else {
            // Regular indicator toggle
            const toggleIndicator = targetTabId && window.__chartIndicatorToggle?.get(targetTabId);
            if (toggleIndicator) {
              toggleIndicator(action.indicator);
            }
          }
        }
        break;
    }
  }, [codePanelOpen, setCodePanelOpen]);

  const chatResult = useChat({
    apiKey: effectiveApiKey,
    model: effectiveModel,
    useOpenRouter: effectiveUseOpenRouter,
    serverProvider: selectedServerProvider,
    onBacktestResult: setBacktestResult,
    onCustomCode: handleCustomCode,
    onUIAction: handleUIAction,
    context: getContext,
    requestConfirmation,
  });

  return chatResult;
}
