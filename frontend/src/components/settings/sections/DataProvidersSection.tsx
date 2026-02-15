import { useState } from 'react'
import { ProviderCard } from '../ProviderCard'
import type { ProviderInfo } from '../../../hooks/useSettings'

interface DataProvidersSectionProps {
  providers: Record<string, ProviderInfo>
  settings: Record<string, string>
  onUpdate: (updates: Record<string, string>) => Promise<void>
  onTestConnection: (provider: string, credentials: Record<string, string>) => Promise<{ status: string; message: string }>
}

const DATA_PROVIDER_ORDER = ['alpaca', 'polygon', 'yfinance', 'fred']

export function DataProvidersSection({ providers, settings, onUpdate, onTestConnection }: DataProvidersSectionProps) {
  const [defaultSource, setDefaultSource] = useState(settings['DEFAULT_EQUITY_SOURCE'] || 'yfinance')

  const dataProviders = DATA_PROVIDER_ORDER
    .map(id => ({ id, provider: providers[id] }))
    .filter(({ provider }) => provider && provider.category === 'data')

  const handleDefaultChange = async (source: string) => {
    setDefaultSource(source)
    await onUpdate({ DEFAULT_EQUITY_SOURCE: source })
  }

  return (
    <div className="space-y-6">
      {/* Default source selector */}
      <div className="p-4 bg-[var(--bg-dark)] rounded-lg border border-[var(--border)]">
        <label className="text-sm text-[var(--text-secondary)] block mb-2">
          Default Equity Data Source
        </label>
        <div className="flex gap-3">
          {[
            { value: 'yfinance', label: 'Yahoo Finance' },
            { value: 'alpaca', label: 'Alpaca' },
            { value: 'polygon', label: 'Polygon' }
          ].map(option => (
            <label
              key={option.value}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                defaultSource === option.value
                  ? 'bg-[var(--green-up)]/10 border border-[var(--green-up)]/30 text-[var(--green-up)]'
                  : 'bg-[var(--bg-medium)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <input
                type="radio"
                name="defaultSource"
                value={option.value}
                checked={defaultSource === option.value}
                onChange={() => handleDefaultChange(option.value)}
                className="sr-only"
              />
              <span className={`w-3 h-3 rounded-full border-2 ${
                defaultSource === option.value
                  ? 'border-[var(--green-up)] bg-[var(--green-up)]'
                  : 'border-[var(--text-tertiary)]'
              }`} />
              <span className="text-sm font-medium">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Provider cards */}
      <div className="space-y-3">
        {dataProviders.map(({ id, provider }) => (
          <ProviderCard
            key={id}
            id={id}
            provider={provider}
            settings={settings}
            onUpdate={onUpdate}
            onTestConnection={onTestConnection}
          />
        ))}
      </div>
    </div>
  )
}
