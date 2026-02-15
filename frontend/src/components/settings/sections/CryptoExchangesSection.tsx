import { useState } from 'react'
import { ProviderCard } from '../ProviderCard'
import type { ProviderInfo } from '../../../hooks/useSettings'

interface CryptoExchangesSectionProps {
  providers: Record<string, ProviderInfo>
  settings: Record<string, string>
  onUpdate: (updates: Record<string, string>) => Promise<void>
  onTestConnection: (provider: string, credentials: Record<string, string>) => Promise<{ status: string; message: string }>
}

const EXCHANGE_ORDER = ['coinbase', 'kraken', 'binance', 'bybit', 'okx']

export function CryptoExchangesSection({ providers, settings, onUpdate, onTestConnection }: CryptoExchangesSectionProps) {
  const [defaultExchange, setDefaultExchange] = useState(settings['DEFAULT_CRYPTO_EXCHANGE'] || 'coinbase')

  const cryptoProviders = EXCHANGE_ORDER
    .map(id => ({ id, provider: providers[id] }))
    .filter(({ provider }) => provider && provider.category === 'crypto')

  const handleDefaultChange = async (exchange: string) => {
    setDefaultExchange(exchange)
    await onUpdate({ DEFAULT_CRYPTO_EXCHANGE: exchange })
  }

  return (
    <div className="space-y-6">
      {/* Default exchange selector */}
      <div className="p-4 bg-[var(--bg-dark)] rounded-lg border border-[var(--border)]">
        <label className="text-sm text-[var(--text-secondary)] block mb-2">
          Default Crypto Exchange
        </label>
        <div className="flex flex-wrap gap-3">
          {[
            { value: 'coinbase', label: 'Coinbase' },
            { value: 'kraken', label: 'Kraken' },
            { value: 'binance', label: 'Binance' },
            { value: 'bybit', label: 'Bybit' },
            { value: 'okx', label: 'OKX' }
          ].map(option => (
            <label
              key={option.value}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                defaultExchange === option.value
                  ? 'bg-[var(--green-up)]/10 border border-[var(--green-up)]/30 text-[var(--green-up)]'
                  : 'bg-[var(--bg-medium)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <input
                type="radio"
                name="defaultExchange"
                value={option.value}
                checked={defaultExchange === option.value}
                onChange={() => handleDefaultChange(option.value)}
                className="sr-only"
              />
              <span className={`w-3 h-3 rounded-full border-2 ${
                defaultExchange === option.value
                  ? 'border-[var(--green-up)] bg-[var(--green-up)]'
                  : 'border-[var(--text-tertiary)]'
              }`} />
              <span className="text-sm font-medium">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Exchange cards */}
      <div className="space-y-3">
        {cryptoProviders.map(({ id, provider }) => (
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

      {/* Warnings */}
      <div className="space-y-3">
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <p className="text-sm text-amber-300">
            <strong>Note:</strong> Binance.com may be geo-restricted in the US.
            Consider using Coinbase or Kraken for US-based users.
          </p>
        </div>

        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-sm text-blue-300">
            <strong>Tip:</strong> Most exchanges provide free public data (no API key required).
            API keys are only needed for authenticated endpoints like trading.
          </p>
        </div>
      </div>
    </div>
  )
}
