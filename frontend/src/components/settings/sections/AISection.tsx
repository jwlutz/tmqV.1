import { useState } from 'react'
import { ProviderCard } from '../ProviderCard'
import type { ProviderInfo } from '../../../hooks/useSettings'

interface AISectionProps {
  providers: Record<string, ProviderInfo>
  settings: Record<string, string>
  onUpdate: (updates: Record<string, string>) => Promise<void>
  onTestConnection: (provider: string, credentials: Record<string, string>) => Promise<{ status: string; message: string }>
}

const AI_PROVIDER_ORDER = ['openrouter', 'anthropic', 'openai', 'google', 'xai']

const OPENROUTER_MODELS = [
  { value: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5 (Fast)', group: 'Anthropic' },
  { value: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5', group: 'Anthropic' },
  { value: 'anthropic/claude-opus-4.6', label: 'Claude Opus 4.6', group: 'Anthropic' },
  { value: 'openai/gpt-5.2-pro', label: 'GPT-5.2 Pro', group: 'OpenAI' },
  { value: 'openai/gpt-5.2', label: 'GPT-5.2', group: 'OpenAI' },
  { value: 'google/gemini-3-pro-preview', label: 'Gemini 3 Pro', group: 'Google' },
  { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash', group: 'Google' },
  { value: 'deepseek/deepseek-v3.2-20251201', label: 'DeepSeek V3.2', group: 'Other' },
  { value: 'mistralai/mistral-large-2512', label: 'Mistral Large', group: 'Other' },
]

export function AISection({ providers, settings, onUpdate, onTestConnection }: AISectionProps) {
  const [useOpenRouter, setUseOpenRouter] = useState(settings['USE_OPENROUTER'] === 'true')
  const [selectedModel, setSelectedModel] = useState(settings['OPENROUTER_MODEL'] || 'anthropic/claude-haiku-4.5')

  const aiProviders = AI_PROVIDER_ORDER
    .map(id => ({ id, provider: providers[id] }))
    .filter(({ provider }) => provider && provider.category === 'ai')

  const handleToggleOpenRouter = async (use: boolean) => {
    setUseOpenRouter(use)
    await onUpdate({ USE_OPENROUTER: use ? 'true' : 'false' })
  }

  const handleModelChange = async (model: string) => {
    setSelectedModel(model)
    await onUpdate({ OPENROUTER_MODEL: model })
  }

  // Get configured providers for model filtering
  const configuredProviders = aiProviders
    .filter(({ provider }) => provider.status === 'connected')
    .map(({ id }) => id)

  return (
    <div className="space-y-6">
      {/* OpenRouter Toggle */}
      <div className="p-4 bg-[var(--bg-dark)] rounded-lg border border-[var(--border)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-medium text-[var(--text-primary)]">Use OpenRouter</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Single API key for access to all models
            </p>
          </div>
          <button
            onClick={() => handleToggleOpenRouter(!useOpenRouter)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              useOpenRouter ? 'bg-[var(--green-up)]' : 'bg-[var(--bg-medium)] border border-[var(--border)]'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                useOpenRouter ? 'translate-x-6' : ''
              }`}
            />
          </button>
        </div>

        {useOpenRouter && (
          <div className="space-y-4 pt-4 border-t border-[var(--border)]">
            {/* Model Selection */}
            <div>
              <label className="text-sm text-[var(--text-secondary)] block mb-2">
                Default Model
              </label>
              <select
                value={selectedModel}
                onChange={e => handleModelChange(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-medium)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-secondary)]"
              >
                {['Anthropic', 'OpenAI', 'Google', 'Other'].map(group => (
                  <optgroup key={group} label={group}>
                    {OPENROUTER_MODELS.filter(m => m.group === group).map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* OpenRouter Card */}
            <ProviderCard
              id="openrouter"
              provider={providers.openrouter}
              settings={settings}
              onUpdate={onUpdate}
              onTestConnection={onTestConnection}
            />
          </div>
        )}
      </div>

      {/* Direct Provider Keys */}
      {!useOpenRouter && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
              Direct Provider Keys
            </h3>
            {configuredProviders.length > 0 && (
              <span className="text-xs text-[var(--green-up)]">
                {configuredProviders.length} configured
              </span>
            )}
          </div>

          <div className="space-y-3">
            {aiProviders
              .filter(({ id }) => id !== 'openrouter')
              .map(({ id, provider }) => (
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
      )}

      {/* Info */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-sm text-blue-300">
          <strong>Tip:</strong> OpenRouter provides unified access to multiple AI providers with a single API key.
          Direct keys give you more control and may be faster for specific providers.
        </p>
      </div>
    </div>
  )
}
