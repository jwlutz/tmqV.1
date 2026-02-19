import { useState } from 'react'
import { ProviderCard } from '../ProviderCard'
import type { ProviderInfo } from '../../../hooks/useSettings'
import { useActionConfirmation, ActionType } from '../../../context/ActionConfirmationContext'

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

// Models for direct provider access
const PROVIDER_MODELS: Record<string, { value: string; label: string }[]> = {
  anthropic: [
    { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4.1', label: 'GPT-4.1' },
    { value: 'o3', label: 'o3' },
    { value: 'o3-mini', label: 'o3-mini' },
  ],
  google: [
    { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro' },
    { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  ],
  xai: [
    { value: 'grok-4', label: 'Grok 4' },
    { value: 'grok-4.1-fast', label: 'Grok 4.1 Fast' },
    { value: 'grok-code-fast-1', label: 'Grok Code Fast' },
  ],
}

export function AISection({ providers, settings, onUpdate, onTestConnection }: AISectionProps) {
  const [useOpenRouter, setUseOpenRouter] = useState(settings['USE_OPENROUTER'] === 'true')
  const [selectedModel, setSelectedModel] = useState(settings['OPENROUTER_MODEL'] || 'anthropic/claude-haiku-4.5')
  const [selectedProvider, setSelectedProvider] = useState(settings['AI_PROVIDER'] || 'anthropic')
  const [directModel, setDirectModel] = useState(settings['AI_MODEL'] || 'claude-sonnet-4-5-20250929')

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

  const handleProviderChange = async (provider: string) => {
    setSelectedProvider(provider)
    // Set default model for this provider
    const models = PROVIDER_MODELS[provider]
    const defaultModel = models?.[0]?.value || ''
    setDirectModel(defaultModel)
    await onUpdate({ AI_PROVIDER: provider, AI_MODEL: defaultModel })
  }

  const handleDirectModelChange = async (model: string) => {
    setDirectModel(model)
    await onUpdate({ AI_MODEL: model })
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
          {/* Provider and Model Selection */}
          <div className="p-4 bg-[var(--bg-dark)] rounded-lg border border-[var(--border)] space-y-4">
            <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
              Default Provider & Model
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[var(--text-secondary)] block mb-2">
                  Provider
                </label>
                <select
                  value={selectedProvider}
                  onChange={e => handleProviderChange(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-medium)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-secondary)]"
                >
                  {aiProviders
                    .filter(({ id }) => id !== 'openrouter')
                    .map(({ id, provider }) => (
                      <option key={id} value={id}>
                        {provider.name} {provider.status === 'connected' ? '✓' : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-[var(--text-secondary)] block mb-2">
                  Model
                </label>
                <select
                  value={directModel}
                  onChange={e => handleDirectModelChange(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-medium)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-secondary)]"
                >
                  {(PROVIDER_MODELS[selectedProvider] || []).map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Provider Cards */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
              API Keys
            </h3>
            {configuredProviders.length > 0 && (
              <span className="text-xs text-[var(--green-up)]">
                {configuredProviders.filter(p => p !== 'openrouter').length} configured
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

      {/* Execution Mode */}
      <ExecutionModeSection />

      {/* Info */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-start gap-3">
        <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-blue-400">Tip</p>
          <p className="text-sm text-blue-300/80 mt-1">
            OpenRouter provides unified access to multiple AI providers with a single API key.
            Direct keys give you more control and may be faster for specific providers.
          </p>
        </div>
      </div>
    </div>
  )
}

const ACTION_TYPE_LABELS: Record<ActionType, { label: string; icon: string }> = {
  backtest: { label: 'Backtests', icon: '\u{1F9EA}' },
  indicator: { label: 'Indicators', icon: '\u{1F4C8}' },
  widget: { label: 'Widget Changes', icon: '\u{1F5BC}' },
  code: { label: 'Code Execution', icon: '\u{1F4BB}' },
}

function ExecutionModeSection() {
  const { preferences, setMode, setAutoApprove } = useActionConfirmation()

  return (
    <div className="p-4 bg-[var(--bg-dark)] rounded-lg border border-[var(--border)] space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-[var(--text-primary)]">AI Action Confirmation</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            Control when TMQ asks before executing actions
          </p>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('ask')}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            preferences.mode === 'ask'
              ? 'bg-[var(--green-up)] text-[var(--bg-darkest)]'
              : 'bg-[var(--bg-medium)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Ask Before Executing
        </button>
        <button
          onClick={() => setMode('auto')}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            preferences.mode === 'auto'
              ? 'bg-[var(--green-up)] text-[var(--bg-darkest)]'
              : 'bg-[var(--bg-medium)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Auto-Execute All
        </button>
      </div>

      {/* Per-action toggles (only show in 'ask' mode) */}
      {preferences.mode === 'ask' && (
        <div className="pt-4 border-t border-[var(--border)] space-y-3">
          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">
            Auto-approve these action types:
          </p>
          {(Object.keys(ACTION_TYPE_LABELS) as ActionType[]).map(type => {
            const { label, icon } = ACTION_TYPE_LABELS[type]
            const isAutoApproved = preferences.autoApprove[type]
            return (
              <label
                key={type}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-[var(--bg-medium)] cursor-pointer hover:bg-white/5 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <span>{icon}</span>
                  {label}
                </span>
                <button
                  onClick={() => setAutoApprove(type, !isAutoApproved)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    isAutoApproved ? 'bg-[var(--green-up)]' : 'bg-[var(--bg-darkest)] border border-[var(--border)]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      isAutoApproved ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
