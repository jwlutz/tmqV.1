import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

// Types of actions that can be confirmed
export type ActionType = 'backtest' | 'indicator' | 'widget' | 'code';

export interface PendingAction {
  id: string;
  type: ActionType;
  title: string;
  description: string;
  details: Record<string, unknown>;
  onApprove: () => void;
  onReject: (feedback?: string) => void;
}

export interface ActionPreferences {
  mode: 'ask' | 'auto';
  autoApprove: {
    backtest: boolean;
    indicator: boolean;
    widget: boolean;
    code: boolean;
  };
}

const DEFAULT_PREFERENCES: ActionPreferences = {
  mode: 'ask',
  autoApprove: {
    backtest: false,
    indicator: false,
    widget: false,
    code: false,
  },
};

interface ActionConfirmationContextValue {
  pendingAction: PendingAction | null;
  preferences: ActionPreferences;
  requestConfirmation: (action: Omit<PendingAction, 'id'>) => Promise<{ approved: boolean; feedback?: string }>;
  setPreferences: (prefs: ActionPreferences) => void;
  setAutoApprove: (type: ActionType, value: boolean) => void;
  setMode: (mode: 'ask' | 'auto') => void;
  shouldAutoApprove: (type: ActionType) => boolean;
}

const ActionConfirmationContext = createContext<ActionConfirmationContextValue | null>(null);

let actionIdCounter = 0;

export function ActionConfirmationProvider({ children }: { children: ReactNode }) {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [preferences, setPreferencesState] = useLocalStorage<ActionPreferences>('actionPreferences', DEFAULT_PREFERENCES);

  const shouldAutoApprove = useCallback((type: ActionType): boolean => {
    if (preferences.mode === 'auto') return true;
    return preferences.autoApprove[type];
  }, [preferences]);

  const requestConfirmation = useCallback((action: Omit<PendingAction, 'id'>): Promise<{ approved: boolean; feedback?: string }> => {
    // If auto-approve is enabled for this type, resolve immediately
    if (shouldAutoApprove(action.type)) {
      action.onApprove();
      return Promise.resolve({ approved: true });
    }

    // Otherwise show the modal and wait for user response
    return new Promise((resolve) => {
      const id = `action-${++actionIdCounter}`;

      const wrappedAction: PendingAction = {
        ...action,
        id,
        onApprove: () => {
          action.onApprove();
          setPendingAction(null);
          resolve({ approved: true });
        },
        onReject: (feedback?: string) => {
          action.onReject(feedback);
          setPendingAction(null);
          resolve({ approved: false, feedback });
        },
      };

      setPendingAction(wrappedAction);
    });
  }, [shouldAutoApprove]);

  const setPreferences = useCallback((prefs: ActionPreferences) => {
    setPreferencesState(prefs);
  }, [setPreferencesState]);

  const setAutoApprove = useCallback((type: ActionType, value: boolean) => {
    setPreferencesState(prev => ({
      ...prev,
      autoApprove: { ...prev.autoApprove, [type]: value },
    }));
  }, [setPreferencesState]);

  const setMode = useCallback((mode: 'ask' | 'auto') => {
    setPreferencesState(prev => ({ ...prev, mode }));
  }, [setPreferencesState]);

  return (
    <ActionConfirmationContext.Provider value={{
      pendingAction,
      preferences,
      requestConfirmation,
      setPreferences,
      setAutoApprove,
      setMode,
      shouldAutoApprove,
    }}>
      {children}
    </ActionConfirmationContext.Provider>
  );
}

export function useActionConfirmation() {
  const context = useContext(ActionConfirmationContext);
  if (!context) {
    throw new Error('useActionConfirmation must be used within ActionConfirmationProvider');
  }
  return context;
}
