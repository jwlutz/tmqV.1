import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { fetchConfig, ServerConfig } from '../api/client';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { WidgetType } from '../widgets/types';
import { LAYOUT_PRESETS } from '../widgets/presets';

type Mode = 'live' | 'backtest';

export type ChartLayout = '1x1' | '1x2' | '2x2';

// Workspace pane types
export type WorkspacePaneType = 'chart' | 'chat' | 'code';

export interface WorkspacePane {
  id: string;
  type: WorkspacePaneType;
}

const DEFAULT_WORKSPACE_PANES: WorkspacePane[] = [
  { id: 'pane-chart', type: 'chart' },
  { id: 'pane-chat', type: 'chat' },
  { id: 'pane-code', type: 'code' },
];

// Provider credential types
export interface AlpacaCredentials {
  apiKey: string;
  secretKey: string;
  endpoint: 'paper' | 'live';
}

export interface PolygonCredentials {
  apiKey: string;
}

export interface ProviderCredentials {
  alpaca?: AlpacaCredentials;
  polygon?: PolygonCredentials;
  // Crypto exchanges (most use API key + secret)
  binance?: { apiKey: string; secretKey: string };
  kraken?: { apiKey: string; secretKey: string };
  bybit?: { apiKey: string; secretKey: string };
  okx?: { apiKey: string; secretKey: string; passphrase: string };
}

// Backend backtest result shape
export interface APIBacktestResult {
  symbol: string;
  strategy: string;
  parameters: Record<string, unknown>;
  metrics: {
    sharpe: number;
    max_drawdown: number;
    cagr: number;
    win_rate: number;
    total_return: number;
    total_trades: number;
    profit_factor: number;
  };
  equity_curve: Array<{ date: string; equity: number }>;
  trades: Array<{
    entry_date: string;
    exit_date: string;
    side: string;
    pnl: number;
    return_pct: number;
  }>;
  provider: string;
}

// Macro overlay for chart panes
export interface MacroOverlay {
  id: string;           // unique id
  seriesId: string;     // FRED series ID like "DGS10"
  name: string;         // display name
  data: Array<{ date: string; value: number }>;
  color: string;
}

// Chart pane state
export interface ChartPaneState {
  id: string;
  symbol: string;
  interval: string;
  indicators: string[]; // selected indicator IDs
  macroOverlays: MacroOverlay[];
  widgetType: WidgetType;
  widgetConfig: Record<string, any>;
}

const DEFAULT_SYMBOL = 'BTC-USD';
const DEFAULT_INTERVAL = '1d';

function createPane(id: string, symbol: string = DEFAULT_SYMBOL, interval: string = DEFAULT_INTERVAL, widgetType: WidgetType = 'candlestick', widgetConfig: Record<string, any> = {}): ChartPaneState {
  return { id, symbol, interval, indicators: [], macroOverlays: [], widgetType, widgetConfig };
}

interface AppContextValue {
  mode: Mode;
  setMode: (mode: Mode) => void;
  symbol: string;
  setSymbol: (symbol: string) => void;
  interval: string;
  setInterval: (interval: string) => void;
  backtestResult: APIBacktestResult | null;
  setBacktestResult: (result: APIBacktestResult | null) => void;
  // AI settings
  apiKey: string;
  setApiKey: (key: string) => void;
  model: string;
  setModel: (model: string) => void;
  aiVendor: string;
  setAiVendor: (vendor: string) => void;
  // OpenRouter settings
  useOpenRouter: boolean;
  setUseOpenRouter: (use: boolean) => void;
  openRouterApiKey: string;
  setOpenRouterApiKey: (key: string) => void;
  openRouterModel: string;
  setOpenRouterModel: (model: string) => void;
  // Server config (providers from .env)
  serverConfig: ServerConfig;
  selectedServerProvider: string | null;  // null = use custom key
  setSelectedServerProvider: (provider: string | null) => void;
  // Data settings
  cryptoExchange: string;
  setCryptoExchange: (exchange: string) => void;
  equitySource: string;
  setEquitySource: (source: string) => void;
  // Provider credentials
  providerCredentials: ProviderCredentials;
  setProviderCredential: <K extends keyof ProviderCredentials>(provider: K, creds: ProviderCredentials[K]) => void;
  // Legacy alias (returns cryptoExchange for backward compat)
  dataVendor: string;
  setDataVendor: (vendor: string) => void;
  // Multi-chart layout
  layout: ChartLayout;
  setLayout: (layout: ChartLayout) => void;
  panes: ChartPaneState[];
  activePaneId: string;
  setActivePaneId: (id: string) => void;
  setPaneSymbol: (paneId: string, symbol: string) => void;
  setPaneInterval: (paneId: string, interval: string) => void;
  setWidgetType: (paneId: string, widgetType: WidgetType) => void;
  applyLayoutPreset: (presetId: string) => void;
  // Code panel
  codePanelOpen: boolean;
  setCodePanelOpen: (open: boolean) => void;
  sandboxCode: string;
  setSandboxCode: (code: string) => void;
  // FRED macro data
  fredApiKey: string;
  setFredApiKey: (key: string) => void;
  fredConfigured: boolean;
  setFredConfigured: (configured: boolean) => void;
  addMacroOverlay: (paneId: string, overlay: MacroOverlay) => void;
  removeMacroOverlay: (paneId: string, overlayId: string) => void;
  // Settings overlay
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  // Workspace panes
  workspacePanes: WorkspacePane[];
  openPane: (type: WorkspacePaneType) => void;
  closePane: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>('live');
  const [symbol, setSymbolState] = useLocalStorage('symbol', DEFAULT_SYMBOL);
  const [interval, setIntervalState] = useLocalStorage('interval', '1d');
  const [backtestResult, setBacktestResult] = useState<APIBacktestResult | null>(null);
  // AI settings (model/vendor persisted, API keys NOT persisted for security)
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useLocalStorage('model', 'gpt-4o-mini');
  const [aiVendor, setAiVendor] = useLocalStorage('aiVendor', 'openai');
  // OpenRouter settings
  const [useOpenRouter, setUseOpenRouter] = useLocalStorage('useOpenRouter', false);
  const [openRouterApiKey, setOpenRouterApiKey] = useState('');
  const [openRouterModel, setOpenRouterModel] = useLocalStorage('openRouterModel', 'anthropic/claude-haiku-4.5');
  // Server config (config fetched from server, selection persisted)
  const [serverConfig, setServerConfig] = useState<ServerConfig>({ providers: {} });
  const [selectedServerProvider, setSelectedServerProvider] = useLocalStorage<string | null>('selectedServerProvider', null);

  // Fetch server config on mount
  useEffect(() => {
    fetchConfig().then(config => {
      setServerConfig(config);
      // Auto-select first available provider
      const available = Object.entries(config.providers)
        .filter(([, v]) => v)
        .map(([k]) => k);
      if (available.length > 0 && !selectedServerProvider) {
        setSelectedServerProvider(available[0]);
      }
    });
  }, []);
  // Data settings (persisted)
  const [cryptoExchange, setCryptoExchange] = useLocalStorage('cryptoExchange', 'coinbase');
  const [equitySource, setEquitySource] = useLocalStorage('equitySource', 'yfinance');
  // Provider credentials
  const [providerCredentials, setProviderCredentials] = useState<ProviderCredentials>({});
  // Multi-chart layout (persisted)
  const [layout, setLayoutState] = useLocalStorage<ChartLayout>('layout', '1x1');
  const [panes, setPanes] = useState<ChartPaneState[]>([createPane('pane-1', DEFAULT_SYMBOL)]);
  const [activePaneId, setActivePaneIdState] = useState('pane-1');
  // Refs for reading current state without stale closures
  const panesRef = useRef(panes);
  panesRef.current = panes;
  const activePaneIdRef = useRef(activePaneId);
  activePaneIdRef.current = activePaneId;
  // Code panel (persisted)
  const [codePanelOpen, setCodePanelOpen] = useLocalStorage('codePanelOpen', true);
  const [sandboxCode, setSandboxCode] = useState('');
  // FRED macro data (persisted so widgets don't flash "not configured" on reload)
  const [fredApiKey, setFredApiKey] = useLocalStorage('fredApiKey', '');
  const [fredConfigured, setFredConfigured] = useLocalStorage('fredConfigured', false);
  // Settings overlay
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Workspace panes (persisted)
  const [workspacePanes, setWorkspacePanes] = useLocalStorage<WorkspacePane[]>('workspacePanes', DEFAULT_WORKSPACE_PANES);

  const openPane = useCallback((type: WorkspacePaneType) => {
    setWorkspacePanes(prev => {
      // Check if pane of this type already exists
      if (prev.some(p => p.type === type)) return prev;
      const id = `pane-${type}-${Date.now()}`;
      return [...prev, { id, type }];
    });
  }, []);

  const closePane = useCallback((id: string) => {
    setWorkspacePanes(prev => prev.filter(p => p.id !== id));
  }, []);

  const setProviderCredential = useCallback(<K extends keyof ProviderCredentials>(
    provider: K,
    creds: ProviderCredentials[K]
  ) => {
    setProviderCredentials(prev => ({ ...prev, [provider]: creds }));
  }, []);

  const handleSetBacktestResult = useCallback((result: APIBacktestResult | null) => {
    setBacktestResult(result);
    if (result) setMode('backtest');
  }, []);

  // Global interval "sync all" — sets interval on ALL panes
  const handleSetInterval = useCallback((newInterval: string) => {
    setIntervalState(newInterval);
    setBacktestResult(null);
    setMode('live');
    setPanes(prev => prev.map(p => ({ ...p, interval: newInterval })));
  }, []);

  const setPaneInterval = useCallback((paneId: string, newInterval: string) => {
    setPanes(prev => prev.map(p =>
      p.id === paneId ? { ...p, interval: newInterval } : p
    ));
    // Sync global interval if active pane changes
    if (paneId === activePaneIdRef.current) {
      setIntervalState(newInterval);
    }
  }, []);

  // Keep global symbol in sync with active pane
  const setSymbol = useCallback((newSymbol: string) => {
    setSymbolState(newSymbol);
    setPanes(prev => prev.map(p =>
      p.id === activePaneIdRef.current ? { ...p, symbol: newSymbol } : p
    ));
  }, []);

  const setPaneSymbol = useCallback((paneId: string, newSymbol: string) => {
    setPanes(prev => prev.map(p =>
      p.id === paneId ? { ...p, symbol: newSymbol } : p
    ));
    if (paneId === activePaneIdRef.current) {
      setSymbolState(newSymbol);
    }
  }, []);

  const handleSetActivePaneId = useCallback((id: string) => {
    setActivePaneIdState(id);
    // Sync global symbol and interval with newly active pane using ref
    const pane = panesRef.current.find(p => p.id === id);
    if (pane) {
      setSymbolState(pane.symbol);
      setIntervalState(pane.interval);
    }
  }, []);

  const addMacroOverlay = useCallback((paneId: string, overlay: MacroOverlay) => {
    setPanes(prev => prev.map(p =>
      p.id === paneId
        ? { ...p, macroOverlays: [...p.macroOverlays.filter(m => m.seriesId !== overlay.seriesId), overlay] }
        : p
    ));
  }, []);

  const removeMacroOverlay = useCallback((paneId: string, overlayId: string) => {
    setPanes(prev => prev.map(p =>
      p.id === paneId
        ? { ...p, macroOverlays: p.macroOverlays.filter(m => m.id !== overlayId) }
        : p
    ));
  }, []);

  const setWidgetType = useCallback((paneId: string, widgetType: WidgetType) => {
    setPanes(prev => prev.map(p =>
      p.id === paneId ? { ...p, widgetType, widgetConfig: {} } : p
    ));
  }, []);

  const applyLayoutPreset = useCallback((presetId: string) => {
    const preset = LAYOUT_PRESETS[presetId];
    if (!preset) return;

    setLayoutState(preset.layout);
    const newPanes = preset.panes.map((p, i) =>
      createPane(`pane-${i + 1}`, p.symbol || DEFAULT_SYMBOL, DEFAULT_INTERVAL, p.widgetType)
    );
    setPanes(newPanes);
    setActivePaneIdState('pane-1');
    setSymbolState(newPanes[0].symbol);
  }, []);

  const setLayout = useCallback((newLayout: ChartLayout) => {
    setLayoutState(newLayout);
    const currentPanes = panesRef.current;
    const currentActive = activePaneIdRef.current;
    let newPanes: ChartPaneState[];

    if (newLayout === '1x1') {
      const active = currentPanes.find(p => p.id === currentActive) || currentPanes[0];
      newPanes = [{ ...active, id: 'pane-1' }];
      setActivePaneIdState('pane-1');
      setSymbolState(active.symbol);
    } else if (newLayout === '1x2') {
      if (currentPanes.length >= 2) {
        newPanes = currentPanes.slice(0, 2);
      } else {
        newPanes = [
          ...currentPanes,
          createPane('pane-2', currentPanes[0]?.symbol || DEFAULT_SYMBOL),
        ];
      }
      if (!newPanes.find(p => p.id === currentActive)) {
        setActivePaneIdState(newPanes[0].id);
        setSymbolState(newPanes[0].symbol);
      }
    } else {
      newPanes = [...currentPanes];
      const defaultSym = currentPanes[0]?.symbol || DEFAULT_SYMBOL;
      while (newPanes.length < 4) {
        newPanes.push(createPane(`pane-${newPanes.length + 1}`, defaultSym));
      }
      newPanes = newPanes.slice(0, 4);
    }

    setPanes(newPanes);
  }, []);

  return (
    <AppContext.Provider value={{
      mode, setMode,
      symbol, setSymbol,
      interval, setInterval: handleSetInterval,
      backtestResult, setBacktestResult: handleSetBacktestResult,
      apiKey, setApiKey,
      model, setModel,
      aiVendor, setAiVendor,
      useOpenRouter, setUseOpenRouter,
      openRouterApiKey, setOpenRouterApiKey,
      openRouterModel, setOpenRouterModel,
      serverConfig, selectedServerProvider, setSelectedServerProvider,
      cryptoExchange, setCryptoExchange,
      equitySource, setEquitySource,
      providerCredentials, setProviderCredential,
      // Legacy aliases
      dataVendor: cryptoExchange,
      setDataVendor: setCryptoExchange,
      // Multi-chart layout
      layout, setLayout,
      panes, activePaneId,
      setActivePaneId: handleSetActivePaneId,
      setPaneSymbol,
      setPaneInterval,
      setWidgetType,
      applyLayoutPreset,
      // Code panel
      codePanelOpen, setCodePanelOpen,
      sandboxCode, setSandboxCode,
      // FRED macro data
      fredApiKey, setFredApiKey,
      fredConfigured, setFredConfigured,
      addMacroOverlay, removeMacroOverlay,
      // Settings overlay
      settingsOpen, setSettingsOpen,
      // Workspace panes
      workspacePanes, openPane, closePane,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}

export function useMode() {
  const { mode, setMode } = useAppContext();
  return { mode, setMode };
}

export function useSymbol() {
  const { symbol, setSymbol } = useAppContext();
  return { symbol, setSymbol };
}

export function useInterval() {
  const { interval, setInterval } = useAppContext();
  return { interval, setInterval };
}

export function useBacktest() {
  const { backtestResult, setBacktestResult } = useAppContext();
  return { backtestResult, setBacktestResult };
}

export function useChatSettings() {
  const {
    apiKey, setApiKey, model, setModel, aiVendor, setAiVendor,
    useOpenRouter, setUseOpenRouter, openRouterApiKey, setOpenRouterApiKey,
    openRouterModel, setOpenRouterModel,
    serverConfig, selectedServerProvider, setSelectedServerProvider
  } = useAppContext();
  return {
    apiKey, setApiKey, model, setModel, aiVendor, setAiVendor,
    useOpenRouter, setUseOpenRouter, openRouterApiKey, setOpenRouterApiKey,
    openRouterModel, setOpenRouterModel,
    serverConfig, selectedServerProvider, setSelectedServerProvider
  };
}

export function useDataSettings() {
  const { cryptoExchange, setCryptoExchange, equitySource, setEquitySource, dataVendor, setDataVendor, providerCredentials, setProviderCredential } = useAppContext();
  return { cryptoExchange, setCryptoExchange, equitySource, setEquitySource, dataVendor, setDataVendor, providerCredentials, setProviderCredential };
}

export function useChartLayout() {
  const { layout, setLayout, panes, activePaneId, setActivePaneId, setPaneSymbol, setPaneInterval, setWidgetType, applyLayoutPreset } = useAppContext();
  return { layout, setLayout, panes, activePaneId, setActivePaneId, setPaneSymbol, setPaneInterval, setWidgetType, applyLayoutPreset };
}

export function useCodePanel() {
  const { codePanelOpen, setCodePanelOpen, sandboxCode, setSandboxCode } = useAppContext();
  return { codePanelOpen, setCodePanelOpen, sandboxCode, setSandboxCode };
}

export function useFredSettings() {
  const { fredApiKey, setFredApiKey, fredConfigured, setFredConfigured } = useAppContext();
  return { fredApiKey, setFredApiKey, fredConfigured, setFredConfigured };
}

export function useMacroOverlays() {
  const { panes, activePaneId, addMacroOverlay, removeMacroOverlay } = useAppContext();
  const activePane = panes.find(p => p.id === activePaneId);
  return {
    macroOverlays: activePane?.macroOverlays || [],
    addMacroOverlay: (overlay: MacroOverlay) => addMacroOverlay(activePaneId, overlay),
    removeMacroOverlay: (overlayId: string) => removeMacroOverlay(activePaneId, overlayId),
  };
}

export function useSettingsOverlay() {
  const { settingsOpen, setSettingsOpen } = useAppContext();
  return { settingsOpen, setSettingsOpen };
}

export function useWorkspace() {
  const { workspacePanes, openPane, closePane } = useAppContext();
  return { panes: workspacePanes, openPane, closePane };
}
