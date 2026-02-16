import { useState, useEffect, useCallback } from 'react';

/**
 * A hook that persists state to localStorage.
 *
 * @param key - The localStorage key (will be prefixed with 'tmq:')
 * @param defaultValue - Default value if nothing in storage
 * @returns [value, setValue] tuple like useState
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const storageKey = `tmq:${key}`;

  // Initialize state from localStorage or default
  const [value, setValueState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        return JSON.parse(stored) as T;
      }
    } catch (e) {
      console.warn(`Failed to parse localStorage key "${storageKey}":`, e);
    }
    return defaultValue;
  });

  // Sync to localStorage whenever value changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch (e) {
      console.warn(`Failed to save to localStorage key "${storageKey}":`, e);
    }
  }, [storageKey, value]);

  // Wrapper that supports functional updates like useState
  const setValue = useCallback((newValue: T | ((prev: T) => T)) => {
    setValueState((prev) => {
      const resolved = typeof newValue === 'function'
        ? (newValue as (prev: T) => T)(prev)
        : newValue;
      return resolved;
    });
  }, []);

  return [value, setValue];
}
