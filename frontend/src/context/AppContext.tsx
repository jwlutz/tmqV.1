import { createContext, useContext, useState, ReactNode } from 'react';

type Mode = 'live' | 'backtest';

interface AppContextValue {
  mode: Mode;
  setMode: (mode: Mode) => void;
  symbol: string;
  setSymbol: (symbol: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>('live');
  const [symbol, setSymbol] = useState('BTC-USD');

  return (
    <AppContext.Provider value={{ mode, setMode, symbol, setSymbol }}>
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
