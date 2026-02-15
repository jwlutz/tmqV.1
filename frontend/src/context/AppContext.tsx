import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type Mode = 'live' | 'backtest';

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
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>('live');
  const [symbol, setSymbol] = useState('BTC-USD');
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
