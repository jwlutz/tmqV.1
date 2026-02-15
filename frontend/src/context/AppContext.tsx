import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

type Mode = 'live' | 'backtest';

export type ChartLayout = '1x1' | '1x2' | '2x2';

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

// Chart pane state
export interface ChartPaneState {
  id: string;
  symbol: string;
  indicators: string[]; // selected indicator IDs
}

const DEFAULT_SYMBOL = 'BTC-USD';

function createPane(id: string, symbol: string = DEFAULT_SYMBOL): ChartPaneState {
  return { id, symbol, indicators: [] };
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
  // Code panel
  codePanelOpen: boolean;
  setCodePanelOpen: (open: boolean) => void;
  sandboxCode: string;
  setSandboxCode: (code: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>('live');
  const [symbol, setSymbolState] = useState(DEFAULT_SYMBOL);
  const [interval, setIntervalState] = useState('1d');
  const [backtestResult, setBacktestResult] = useState<APIBacktestResult | null>(null);
  // AI settings
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [aiVendor, setAiVendor] = useState('openai');
  // Data settings
  const [cryptoExchange, setCryptoExchange] = useState('coinbase');
  const [equitySource, setEquitySource] = useState('yfinance');
  // Provider credentials
  const [providerCredentials, setProviderCredentials] = useState<ProviderCredentials>({});
  // Multi-chart layout
  const [layout, setLayoutState] = useState<ChartLayout>('1x1');
  const [panes, setPanes] = useState<ChartPaneState[]>([createPane('pane-1', DEFAULT_SYMBOL)]);
  const [activePaneId, setActivePaneIdState] = useState('pane-1');
  // Refs for reading current state without stale closures
  const panesRef = useRef(panes);
  panesRef.current = panes;
  const activePaneIdRef = useRef(activePaneId);
  activePaneIdRef.current = activePaneId;
  // Code panel
  const [codePanelOpen, setCodePanelOpen] = useState(false);
  const [sandboxCode, setSandboxCode] = useState('');

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

  const handleSetInterval = useCallback((newInterval: string) => {
    setIntervalState(newInterval);
    setBacktestResult(null);
    setMode('live');
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
    // Sync global symbol with newly active pane using ref
    const pane = panesRef.current.find(p => p.id === id);
    if (pane) setSymbolState(pane.symbol);
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
      // Code panel
      codePanelOpen, setCodePanelOpen,
      sandboxCode, setSandboxCode,
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
  const { apiKey, setApiKey, model, setModel, aiVendor, setAiVendor } = useAppContext();
  return { apiKey, setApiKey, model, setModel, aiVendor, setAiVendor };
}

export function useDataSettings() {
  const { cryptoExchange, setCryptoExchange, equitySource, setEquitySource, dataVendor, setDataVendor, providerCredentials, setProviderCredential } = useAppContext();
  return { cryptoExchange, setCryptoExchange, equitySource, setEquitySource, dataVendor, setDataVendor, providerCredentials, setProviderCredential };
}

export function useChartLayout() {
  const { layout, setLayout, panes, activePaneId, setActivePaneId, setPaneSymbol } = useAppContext();
  return { layout, setLayout, panes, activePaneId, setActivePaneId, setPaneSymbol };
}

export function useCodePanel() {
  const { codePanelOpen, setCodePanelOpen, sandboxCode, setSandboxCode } = useAppContext();
  return { codePanelOpen, setCodePanelOpen, sandboxCode, setSandboxCode };
}
