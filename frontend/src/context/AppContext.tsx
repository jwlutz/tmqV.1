import { createContext, useContext, useState, ReactNode } from 'react';

type Mode = 'live' | 'backtest';

interface AppContextValue {
  mode: Mode;
  setMode: (mode: Mode) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>('live');

  return (
    <AppContext.Provider value={{ mode, setMode }}>
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
