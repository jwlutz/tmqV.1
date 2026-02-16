import { useState, useEffect, useCallback } from 'react'

const BASE_URL = 'http://localhost:8000'

export interface ProviderInfo {
  name: string
  description: string
  keys: string[]
  optional_keys?: string[]
  docs_url?: string
  category: 'data' | 'ai' | 'crypto'
  status: 'connected' | 'not_configured' | 'error'
}

interface SettingsData {
  settings: Record<string, string>
  providers: Record<string, ProviderInfo>
  raw: string
}

interface TestConnectionResult {
  status: 'ok' | 'error' | 'warning'
  message: string
}

export function useSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [providers, setProviders] = useState<Record<string, ProviderInfo>>({})
  const [rawEnv, setRawEnv] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const fetchSettings = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`${BASE_URL}/api/settings`)
      if (!res.ok) throw new Error('Failed to fetch settings')
      const data: SettingsData = await res.json()
      setSettings(data.settings)
      setProviders(data.providers)
      setRawEnv(data.raw)
      const keyCount = Object.keys(data.settings).length
      if (keyCount > 0) {
        showToast(`Loaded ${keyCount} keys from .env`, 'success')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const updateSettings = useCallback(async (updates: Record<string, string>) => {
    try {
      const res = await fetch(`${BASE_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: updates })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to save settings')
      }
      showToast('Settings saved', 'success')
      // Refetch to get updated state
      await fetchSettings()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save', 'error')
      throw err
    }
  }, [fetchSettings, showToast])

  const updateRaw = useCallback(async (raw: string) => {
    try {
      const res = await fetch(`${BASE_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to save settings')
      }
      showToast('Settings saved', 'success')
      await fetchSettings()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save', 'error')
      throw err
    }
  }, [fetchSettings, showToast])

  const testConnection = useCallback(async (
    provider: string,
    credentials: Record<string, string>,
    useSaved: boolean = false
  ): Promise<TestConnectionResult> => {
    try {
      const res = await fetch(`${BASE_URL}/api/settings/test/${provider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentials, use_saved: useSaved })
      })
      const data = await res.json()
      if (data.status === 'ok') {
        showToast(data.message || 'Connection successful', 'success')
      } else if (data.status === 'error') {
        showToast(data.message || 'Connection failed', 'error')
      }
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection test failed'
      showToast(message, 'error')
      return { status: 'error', message }
    }
  }, [showToast])

  return {
    settings,
    providers,
    rawEnv,
    isLoading,
    error,
    toast,
    refetch: fetchSettings,
    updateSettings,
    updateRaw,
    testConnection
  }
}
