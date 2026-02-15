import { useState, useEffect, useCallback } from 'react'
import { SettingsSidebar, SettingsSection } from './SettingsSidebar'
import { DataProvidersSection } from './sections/DataProvidersSection'
import { AISection } from './sections/AISection'
import { CryptoExchangesSection } from './sections/CryptoExchangesSection'
import { AdvancedSection } from './sections/AdvancedSection'
import { useSettings } from '../../hooks/useSettings'

interface SettingsOverlayProps {
  onClose: () => void
}

export function SettingsOverlay({ onClose }: SettingsOverlayProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('data')
  const [isClosing, setIsClosing] = useState(false)
  const { settings, providers, rawEnv, isLoading, error, refetch, updateSettings, updateRaw, testConnection } = useSettings()

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(onClose, 200) // Match animation duration
  }, [onClose])

  // Prevent body scroll when overlay is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const renderSection = () => {
    switch (activeSection) {
      case 'data':
        return (
          <DataProvidersSection
            providers={providers}
            settings={settings}
            onUpdate={updateSettings}
            onTestConnection={testConnection}
          />
        )
      case 'ai':
        return (
          <AISection
            providers={providers}
            settings={settings}
            onUpdate={updateSettings}
            onTestConnection={testConnection}
          />
        )
      case 'crypto':
        return (
          <CryptoExchangesSection
            providers={providers}
            settings={settings}
            onUpdate={updateSettings}
            onTestConnection={testConnection}
          />
        )
      case 'advanced':
        return (
          <AdvancedSection
            rawEnv={rawEnv}
            onSave={updateRaw}
            onRefresh={refetch}
          />
        )
      default:
        return null
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex transition-opacity duration-200 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal Container */}
      <div
        className={`relative m-auto w-full max-w-5xl h-[90vh] bg-[var(--bg-darkest)] rounded-xl shadow-2xl overflow-hidden flex transform transition-transform duration-200 ${
          isClosing ? 'scale-95' : 'scale-100'
        }`}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
          aria-label="Close settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Sidebar */}
        <SettingsSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-[var(--bg-darkest)] border-b border-[var(--border)] px-8 py-6 z-10">
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">
              {activeSection === 'data' && 'Data Providers'}
              {activeSection === 'ai' && 'AI / LLM'}
              {activeSection === 'crypto' && 'Crypto Exchanges'}
              {activeSection === 'advanced' && 'Advanced'}
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {activeSection === 'data' && 'Configure your market data sources'}
              {activeSection === 'ai' && 'Set up AI providers for chat and analysis'}
              {activeSection === 'crypto' && 'Connect cryptocurrency exchanges'}
              {activeSection === 'advanced' && 'Edit raw .env configuration'}
            </p>
          </div>

          {/* Content */}
          <div className="p-8">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--green-up)] border-t-transparent" />
              </div>
            ) : error ? (
              <div className="p-4 bg-[var(--red-down)]/10 border border-[var(--red-down)]/30 rounded-lg text-[var(--red-down)]">
                {error}
              </div>
            ) : (
              renderSection()
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
