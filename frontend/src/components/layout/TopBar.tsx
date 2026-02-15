import { useState, useRef, useEffect } from 'react'
import { useMode, useChatSettings, useDataSettings, AlpacaCredentials, PolygonCredentials } from '../../context'
import { configureDataProvider } from '../../api/client'

// AI Providers and Models
const AI_VENDORS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'xai', label: 'xAI' },
]

const OPENAI_MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'o3', label: 'o3' },
  { value: 'o3-mini', label: 'o3-mini' },
  { value: 'o4-mini', label: 'o4-mini' },
]

const ANTHROPIC_MODELS = [
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
]

const GOOGLE_MODELS = [
  { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
]

const XAI_MODELS = [
  { value: 'grok-4', label: 'Grok 4' },
  { value: 'grok-4.1-fast', label: 'Grok 4.1 Fast' },
  { value: 'grok-code-fast-1', label: 'Grok Code Fast' },
]

// OpenRouter models (provider/model format) - Updated Feb 2026
const OPENROUTER_MODELS = [
  // Anthropic (Claude) - XML prompts
  { value: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5 (Fast)', provider: 'anthropic' },
  { value: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5', provider: 'anthropic' },
  { value: 'anthropic/claude-opus-4.6', label: 'Claude Opus 4.6', provider: 'anthropic' },
  { value: 'anthropic/claude-opus-4.5', label: 'Claude Opus 4.5', provider: 'anthropic' },
  // OpenAI (GPT) - Markdown prompts
  { value: 'openai/gpt-5.2-pro', label: 'GPT-5.2 Pro', provider: 'openai' },
  { value: 'openai/gpt-5.2', label: 'GPT-5.2', provider: 'openai' },
  { value: 'openai/gpt-5.2-codex', label: 'GPT-5.2 Codex', provider: 'openai' },
  { value: 'openai/gpt-5.2-chat', label: 'GPT-5.2 Chat', provider: 'openai' },
  // Google (Gemini) - Concise prompts
  { value: 'google/gemini-3-pro-preview', label: 'Gemini 3 Pro', provider: 'google' },
  { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash', provider: 'google' },
  { value: 'google/gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image', provider: 'google' },
  // xAI (Grok) - uses OpenAI format
  { value: 'x-ai/grok-4.1-fast', label: 'Grok 4.1 Fast', provider: 'openai' },
  // DeepSeek - uses OpenAI format
  { value: 'deepseek/deepseek-v3.2-20251201', label: 'DeepSeek V3.2', provider: 'openai' },
  { value: 'deepseek/deepseek-v3.2-speciale-20251201', label: 'DeepSeek V3.2 Speciale', provider: 'openai' },
  // Mistral - uses OpenAI format
  { value: 'mistralai/mistral-large-2512', label: 'Mistral Large', provider: 'openai' },
  { value: 'mistralai/devstral-2512', label: 'Devstral', provider: 'openai' },
]

// Data Sources
const CRYPTO_EXCHANGES = [
  { value: 'coinbase', label: 'Coinbase' },
  { value: 'binance', label: 'Binance' },
  { value: 'kraken', label: 'Kraken' },
  { value: 'bybit', label: 'Bybit' },
  { value: 'okx', label: 'OKX' },
]

const EQUITY_SOURCES = [
  { value: 'yfinance', label: 'Yahoo Finance' },
  { value: 'polygon', label: 'Polygon.io' },
  { value: 'alpaca', label: 'Alpaca' },
]

function getModelsForVendor(vendor: string) {
  switch (vendor) {
    case 'anthropic': return ANTHROPIC_MODELS
    case 'google': return GOOGLE_MODELS
    case 'xai': return XAI_MODELS
    default: return OPENAI_MODELS
  }
}

// Provider display names
const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  google: 'Google',
  xai: 'xAI',
}

export function TopBar() {
  const { mode, setMode } = useMode()
  const {
    apiKey, setApiKey, model, setModel, aiVendor, setAiVendor,
    useOpenRouter, setUseOpenRouter, openRouterApiKey, setOpenRouterApiKey,
    openRouterModel, setOpenRouterModel,
    serverConfig, selectedServerProvider, setSelectedServerProvider
  } = useChatSettings()
  const { cryptoExchange, setCryptoExchange, equitySource, setEquitySource, providerCredentials, setProviderCredential } = useDataSettings()
  const [showSettings, setShowSettings] = useState(false)
  const [alpacaStatus, setAlpacaStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const settingsRef = useRef<HTMLDivElement>(null)

  // Get models for current AI vendor
  const availableModels = getModelsForVendor(aiVendor)

  // Get configured providers from server
  const configuredProviders = Object.entries(serverConfig.providers)
    .filter(([, v]) => v)
    .map(([k]) => k)
  const hasServerProviders = configuredProviders.length > 0

  // Alpaca credential handlers
  const alpacaCreds = providerCredentials.alpaca || { apiKey: '', secretKey: '', endpoint: 'paper' as const }
  const updateAlpacaCreds = (partial: Partial<AlpacaCredentials>) => {
    setProviderCredential('alpaca', { ...alpacaCreds, ...partial })
  }

  const handleAlpacaConnect = async () => {
    if (!alpacaCreds.apiKey || !alpacaCreds.secretKey) return
    setAlpacaStatus('connecting')
    try {
      const res = await configureDataProvider('alpaca', alpacaCreds.apiKey, alpacaCreds.secretKey)
      setAlpacaStatus(res.status === 'ok' ? 'connected' : 'error')
    } catch {
      setAlpacaStatus('error')
    }
  }

  // Polygon credential handlers
  const polygonCreds = providerCredentials.polygon || { apiKey: '' }
  const updatePolygonCreds = (partial: Partial<PolygonCredentials>) => {
    setProviderCredential('polygon', { ...polygonCreds, ...partial })
  }

  // Reset model when vendor changes
  useEffect(() => {
    const models = getModelsForVendor(aiVendor)
    if (!models.find(m => m.value === model)) {
      setModel(models[0].value)
    }
  }, [aiVendor, model, setModel])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false)
      }
    }
    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSettings])

  return (
    <header className="h-12 flex-none bg-[var(--bg-dark)] border-b border-[var(--border)] flex items-center justify-between px-3 md:px-4">
      <div className="flex items-center gap-3">
        <a
          href="https://github.com/jwlutz/tmqV.1"
          target="_blank"
          rel="noopener noreferrer"
          className="text-base font-semibold text-[var(--text-primary)] hover:text-[var(--green-up)] transition-colors"
        >
          <span className="hidden sm:inline">thats_my_quant</span>
          <span className="sm:hidden">TMQ</span>
        </a>
      </div>

      <div className="flex items-center gap-2">
        {/* Mode toggle */}
        <div className="flex items-center rounded-full border border-[var(--border)] p-0.5">
          <button
            onClick={() => setMode('live')}
            aria-pressed={mode === 'live'}
            aria-label="Switch to live trading view"
            className={`px-2 py-1 rounded-full text-xs font-medium transition-all ${
              mode === 'live'
                ? 'bg-[var(--green-up)] text-[var(--bg-darkest)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Live
          </button>
          <button
            onClick={() => setMode('backtest')}
            aria-pressed={mode === 'backtest'}
            aria-label="Switch to backtest results view"
            className={`px-2 py-1 rounded-full text-xs font-medium transition-all ${
              mode === 'backtest'
                ? 'bg-[var(--green-up)] text-[var(--bg-darkest)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Backtest
          </button>
        </div>

        {/* Settings dropdown */}
        <div className="relative" ref={settingsRef}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            aria-label="Open settings"
            aria-expanded={showSettings}
            className={`p-1.5 rounded-lg transition-colors ${
              showSettings
                ? 'bg-white/10 text-[var(--green-up)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {showSettings && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-[var(--bg-dark)] border border-[var(--border)] rounded-lg shadow-xl z-50">
              <div className="p-2 border-b border-[var(--border)]">
                <h3 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">Settings</h3>
              </div>

              {/* Crypto Data Settings */}
              <div className="p-2 border-b border-[var(--border)]">
                <h4 className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Crypto Data</h4>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] block mb-1">Exchange</label>
                  <select
                    value={cryptoExchange}
                    onChange={e => setCryptoExchange(e.target.value)}
                    className="w-full px-2 py-1 bg-[var(--bg-medium)] border border-[var(--border)]
                               rounded text-xs text-[var(--text-primary)]
                               outline-none focus:border-[var(--text-secondary)]"
                  >
                    {CRYPTO_EXCHANGES.map(v => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Equity Data Settings */}
              <div className="p-2 border-b border-[var(--border)] space-y-2">
                <h4 className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">Equity Data</h4>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] block mb-1">Source</label>
                  <select
                    value={equitySource}
                    onChange={e => setEquitySource(e.target.value)}
                    className="w-full px-2 py-1 bg-[var(--bg-medium)] border border-[var(--border)]
                               rounded text-xs text-[var(--text-primary)]
                               outline-none focus:border-[var(--text-secondary)]"
                  >
                    {EQUITY_SOURCES.map(v => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                </div>

                {/* Alpaca Credentials */}
                {equitySource === 'alpaca' && (
                  <>
                    <div>
                      <label className="text-xs text-[var(--text-secondary)] block mb-1">Environment</label>
                      <select
                        value={alpacaCreds.endpoint}
                        onChange={e => updateAlpacaCreds({ endpoint: e.target.value as 'paper' | 'live' })}
                        className="w-full px-2 py-1 bg-[var(--bg-medium)] border border-[var(--border)]
                                   rounded text-xs text-[var(--text-primary)]
                                   outline-none focus:border-[var(--text-secondary)]"
                      >
                        <option value="paper">Paper Trading</option>
                        <option value="live">Live Trading</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-[var(--text-secondary)] block mb-1">API Key</label>
                      <input
                        type="password"
                        value={alpacaCreds.apiKey}
                        onChange={e => updateAlpacaCreds({ apiKey: e.target.value })}
                        placeholder="APCA-API-KEY-ID"
                        className="w-full px-2 py-1 bg-[var(--bg-medium)] border border-[var(--border)]
                                   rounded text-xs text-[var(--text-primary)] font-mono
                                   placeholder:text-[var(--text-tertiary)] outline-none
                                   focus:border-[var(--text-secondary)]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[var(--text-secondary)] block mb-1">Secret Key</label>
                      <input
                        type="password"
                        value={alpacaCreds.secretKey}
                        onChange={e => updateAlpacaCreds({ secretKey: e.target.value })}
                        placeholder="APCA-API-SECRET-KEY"
                        className="w-full px-2 py-1 bg-[var(--bg-medium)] border border-[var(--border)]
                                   rounded text-xs text-[var(--text-primary)] font-mono
                                   placeholder:text-[var(--text-tertiary)] outline-none
                                   focus:border-[var(--text-secondary)]"
                      />
                    </div>
                    <button
                      onClick={handleAlpacaConnect}
                      disabled={!alpacaCreds.apiKey || !alpacaCreds.secretKey || alpacaStatus === 'connecting'}
                      className={`w-full px-2 py-1 rounded text-xs font-medium transition-colors ${
                        alpacaStatus === 'connected'
                          ? 'bg-[var(--green-up)]/20 text-[var(--green-up)] border border-[var(--green-up)]/30'
                          : alpacaStatus === 'error'
                            ? 'bg-[var(--red-down)]/20 text-[var(--red-down)] border border-[var(--red-down)]/30'
                            : 'bg-white/5 text-[var(--text-primary)] border border-[var(--border)] hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed'
                      }`}
                    >
                      {alpacaStatus === 'connecting' ? 'Connecting...'
                        : alpacaStatus === 'connected' ? 'Connected'
                        : alpacaStatus === 'error' ? 'Connection Failed — Retry'
                        : 'Connect'}
                    </button>
                  </>
                )}

                {/* Polygon Credentials */}
                {equitySource === 'polygon' && (
                  <div>
                    <label className="text-xs text-[var(--text-secondary)] block mb-1">API Key</label>
                    <input
                      type="password"
                      value={polygonCreds.apiKey}
                      onChange={e => updatePolygonCreds({ apiKey: e.target.value })}
                      placeholder="Polygon API Key"
                      className="w-full px-2 py-1 bg-[var(--bg-medium)] border border-[var(--border)]
                                 rounded text-xs text-[var(--text-primary)] font-mono
                                 placeholder:text-[var(--text-tertiary)] outline-none
                                 focus:border-[var(--text-secondary)]"
                    />
                  </div>
                )}

                {/* Info for yfinance */}
                {equitySource === 'yfinance' && (
                  <p className="text-xs text-[var(--text-tertiary)] italic">
                    No API key required
                  </p>
                )}
              </div>

              {/* AI Settings */}
              <div className="p-2 space-y-2">
                <h4 className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">AI</h4>

                {/* Provider Selection */}
                <div>
                  <label className="text-xs text-[var(--text-secondary)] block mb-1">Provider</label>
                  <select
                    value={selectedServerProvider || '_custom'}
                    onChange={e => {
                      const val = e.target.value
                      if (val === '_custom') {
                        setSelectedServerProvider(null)
                      } else {
                        setSelectedServerProvider(val)
                        // Auto-set useOpenRouter based on provider
                        setUseOpenRouter(val === 'openrouter')
                      }
                    }}
                    className="w-full px-2 py-1 bg-[var(--bg-medium)] border border-[var(--border)]
                               rounded text-xs text-[var(--text-primary)]
                               outline-none focus:border-[var(--text-secondary)]"
                  >
                    {/* Server-configured providers */}
                    {hasServerProviders && (
                      <optgroup label="Server Keys">
                        {configuredProviders.map(p => (
                          <option key={p} value={p}>
                            {PROVIDER_LABELS[p] || p} (server)
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {/* Custom key option */}
                    <optgroup label="Manual">
                      <option value="_custom">Custom API Key</option>
                    </optgroup>
                  </select>
                </div>

                {/* Server provider status */}
                {selectedServerProvider && (
                  <div className="flex items-center gap-1.5 text-xs text-[var(--green-up)]">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Using server key
                  </div>
                )}

                {/* Custom key mode OR OpenRouter via server */}
                {selectedServerProvider === null ? (
                  <>
                    {/* OpenRouter Toggle for custom mode */}
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-[var(--text-secondary)]">Use OpenRouter</label>
                      <button
                        onClick={() => setUseOpenRouter(!useOpenRouter)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          useOpenRouter ? 'bg-[var(--green-up)]' : 'bg-[var(--bg-medium)] border border-[var(--border)]'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                            useOpenRouter ? 'translate-x-5' : ''
                          }`}
                        />
                      </button>
                    </div>

                    {useOpenRouter ? (
                      <>
                        {/* OpenRouter Model Selection */}
                        <div>
                          <label className="text-xs text-[var(--text-secondary)] block mb-1">Model</label>
                          <select
                            value={openRouterModel}
                            onChange={e => setOpenRouterModel(e.target.value)}
                            className="w-full px-2 py-1 bg-[var(--bg-medium)] border border-[var(--border)]
                                       rounded text-xs text-[var(--text-primary)]
                                       outline-none focus:border-[var(--text-secondary)]"
                          >
                            <optgroup label="Anthropic (Claude)">
                              {OPENROUTER_MODELS.filter(m => m.provider === 'anthropic').map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                              ))}
                            </optgroup>
                            <optgroup label="OpenAI (GPT)">
                              {OPENROUTER_MODELS.filter(m => m.provider === 'openai' && m.value.startsWith('openai/')).map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Google (Gemini)">
                              {OPENROUTER_MODELS.filter(m => m.provider === 'google').map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Other">
                              {OPENROUTER_MODELS.filter(m => !m.value.startsWith('anthropic/') && !m.value.startsWith('openai/') && !m.value.startsWith('google/')).map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                              ))}
                            </optgroup>
                          </select>
                        </div>
                        {/* OpenRouter API Key */}
                        <div>
                          <label className="text-xs text-[var(--text-secondary)] block mb-1">OpenRouter API Key</label>
                          <input
                            type="password"
                            value={openRouterApiKey}
                            onChange={e => setOpenRouterApiKey(e.target.value)}
                            placeholder="sk-or-v1-..."
                            className="w-full px-2 py-1 bg-[var(--bg-medium)] border border-[var(--border)]
                                       rounded text-xs text-[var(--text-primary)] font-mono
                                       placeholder:text-[var(--text-tertiary)] outline-none
                                       focus:border-[var(--text-secondary)]"
                          />
                        </div>
                        <p className="text-xs text-[var(--text-tertiary)] italic">
                          One API key for all providers
                        </p>
                      </>
                    ) : (
                      <>
                        {/* Direct Provider Settings */}
                        <div>
                          <label className="text-xs text-[var(--text-secondary)] block mb-1">Vendor</label>
                          <select
                            value={aiVendor}
                            onChange={e => setAiVendor(e.target.value)}
                            className="w-full px-2 py-1 bg-[var(--bg-medium)] border border-[var(--border)]
                                       rounded text-xs text-[var(--text-primary)]
                                       outline-none focus:border-[var(--text-secondary)]"
                          >
                            {AI_VENDORS.map(v => (
                              <option key={v.value} value={v.value}>{v.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-[var(--text-secondary)] block mb-1">Model</label>
                          <select
                            value={model}
                            onChange={e => setModel(e.target.value)}
                            className="w-full px-2 py-1 bg-[var(--bg-medium)] border border-[var(--border)]
                                       rounded text-xs text-[var(--text-primary)]
                                       outline-none focus:border-[var(--text-secondary)]"
                          >
                            {availableModels.map(m => (
                              <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-[var(--text-secondary)] block mb-1">API Key</label>
                          <input
                            type="password"
                            value={apiKey}
                            onChange={e => setApiKey(e.target.value)}
                            placeholder="sk-... or sk-ant-..."
                            className="w-full px-2 py-1 bg-[var(--bg-medium)] border border-[var(--border)]
                                       rounded text-xs text-[var(--text-primary)] font-mono
                                       placeholder:text-[var(--text-tertiary)] outline-none
                                       focus:border-[var(--text-secondary)]"
                          />
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {/* Server provider model selection */}
                    {selectedServerProvider === 'openrouter' ? (
                      <div>
                        <label className="text-xs text-[var(--text-secondary)] block mb-1">Model</label>
                        <select
                          value={openRouterModel}
                          onChange={e => setOpenRouterModel(e.target.value)}
                          className="w-full px-2 py-1 bg-[var(--bg-medium)] border border-[var(--border)]
                                     rounded text-xs text-[var(--text-primary)]
                                     outline-none focus:border-[var(--text-secondary)]"
                        >
                          <optgroup label="Anthropic (Claude)">
                            {OPENROUTER_MODELS.filter(m => m.provider === 'anthropic').map(m => (
                              <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                          </optgroup>
                          <optgroup label="OpenAI (GPT)">
                            {OPENROUTER_MODELS.filter(m => m.provider === 'openai' && m.value.startsWith('openai/')).map(m => (
                              <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Google (Gemini)">
                            {OPENROUTER_MODELS.filter(m => m.provider === 'google').map(m => (
                              <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Other">
                            {OPENROUTER_MODELS.filter(m => !m.value.startsWith('anthropic/') && !m.value.startsWith('openai/') && !m.value.startsWith('google/')).map(m => (
                              <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="text-xs text-[var(--text-secondary)] block mb-1">Model</label>
                        <select
                          value={model}
                          onChange={e => setModel(e.target.value)}
                          className="w-full px-2 py-1 bg-[var(--bg-medium)] border border-[var(--border)]
                                     rounded text-xs text-[var(--text-primary)]
                                     outline-none focus:border-[var(--text-secondary)]"
                        >
                          {getModelsForVendor(selectedServerProvider).map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
