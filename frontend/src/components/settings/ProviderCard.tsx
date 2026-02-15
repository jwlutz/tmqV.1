import { useState } from 'react'
import type { ProviderInfo } from '../../hooks/useSettings'

interface ProviderCardProps {
  id: string
  provider: ProviderInfo
  settings: Record<string, string>
  onUpdate: (updates: Record<string, string>) => Promise<void>
  onTestConnection: (provider: string, credentials: Record<string, string>) => Promise<{ status: string; message: string }>
}

export function ProviderCard({ id, provider, settings, onUpdate, onTestConnection }: ProviderCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [localValues, setLocalValues] = useState<Record<string, string>>({})
  const [showValues, setShowValues] = useState<Record<string, boolean>>({})
  const [isTesting, setIsTesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ status: string; message: string } | null>(null)

  // Initialize local values when expanded
  const handleExpand = () => {
    if (!isExpanded) {
      const initial: Record<string, string> = {}
      for (const key of provider.keys) {
        // If setting shows masked value (contains *), use empty string for editing
        const value = settings[key] || ''
        initial[key] = value.includes('*') ? '' : value
      }
      setLocalValues(initial)
    }
    setIsExpanded(!isExpanded)
  }

  const handleValueChange = (key: string, value: string) => {
    setLocalValues(prev => ({ ...prev, [key]: value }))
  }

  const toggleShowValue = (key: string) => {
    setShowValues(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onUpdate(localValues)
      setIsExpanded(false)
    } catch {
      // Error handled by hook
    } finally {
      setIsSaving(false)
    }
  }

  const handleTest = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      const result = await onTestConnection(id, localValues)
      setTestResult(result)
    } catch {
      // Error handled by hook
    } finally {
      setIsTesting(false)
    }
  }

  const getStatusBadge = () => {
    if (provider.status === 'connected') {
      return (
        <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--green-up)]">
          <span className="w-2 h-2 rounded-full bg-[var(--green-up)]" />
          Connected
        </span>
      )
    } else if (provider.status === 'error') {
      return (
        <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--red-down)]">
          <span className="w-2 h-2 rounded-full bg-[var(--red-down)]" />
          Error
        </span>
      )
    } else {
      return (
        <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-tertiary)]">
          <span className="w-2 h-2 rounded-full bg-[var(--text-tertiary)]" />
          Not Configured
        </span>
      )
    }
  }

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
      {/* Header (always visible) */}
      <button
        onClick={handleExpand}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[var(--bg-medium)] flex items-center justify-center text-lg">
            {provider.name.charAt(0)}
          </div>
          <div>
            <h3 className="font-medium text-[var(--text-primary)]">{provider.name}</h3>
            <p className="text-sm text-[var(--text-secondary)]">{provider.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge()}
          <svg
            className={`w-5 h-5 text-[var(--text-secondary)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-[var(--border)] p-4 bg-[var(--bg-medium)]/50 space-y-4">
          {provider.keys.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] italic">
              No API key required
            </p>
          ) : (
            <>
              {/* Key inputs */}
              {provider.keys.map(key => (
                <div key={key}>
                  <label className="text-xs text-[var(--text-secondary)] block mb-1.5">
                    {key.replace(/_/g, ' ').replace(/API KEY/i, 'API Key')}
                  </label>
                  <div className="relative">
                    <input
                      type={showValues[key] ? 'text' : 'password'}
                      value={localValues[key] || ''}
                      onChange={e => handleValueChange(key, e.target.value)}
                      placeholder={settings[key]?.includes('*') ? 'Enter new value to update' : 'Not configured'}
                      className="w-full px-3 py-2 pr-10 bg-[var(--bg-dark)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] font-mono placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--text-secondary)]"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowValue(key)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                    >
                      {showValues[key] ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              ))}

              {/* Test result */}
              {testResult && (
                <div className={`p-3 rounded-lg text-sm ${
                  testResult.status === 'ok'
                    ? 'bg-[var(--green-up)]/10 text-[var(--green-up)] border border-[var(--green-up)]/30'
                    : testResult.status === 'warning'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : 'bg-[var(--red-down)]/10 text-[var(--red-down)] border border-[var(--red-down)]/30'
                }`}>
                  {testResult.message}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleTest}
                  disabled={isTesting || !provider.keys.some(k => localValues[k])}
                  className="px-4 py-2 bg-white/5 border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--text-primary)] hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !provider.keys.some(k => localValues[k])}
                  className="px-4 py-2 bg-[var(--green-up)] rounded-lg text-sm font-medium text-[var(--bg-darkest)] hover:bg-[var(--green-up)]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                {provider.docs_url && (
                  <a
                    href={provider.docs_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    Get API Key
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
