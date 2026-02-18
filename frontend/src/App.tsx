import { useEffect } from 'react'
import './App.css'
import { AppProvider, useMode, useSettingsOverlay } from './context'
import { TopBar } from './components/layout'
import { FlexWorkspace } from './components/workspace'
import { SettingsOverlay } from './components/settings'
import { ErrorBoundary } from './components/ui'

function useKeyboardShortcuts() {
  const { setMode } = useMode()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault()
        setMode('live')
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '2') {
        e.preventDefault()
        setMode('backtest')
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setMode])
}

function AppContent() {
  useKeyboardShortcuts()
  const { settingsOpen, setSettingsOpen } = useSettingsOverlay()

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <ErrorBoundary>
        <FlexWorkspace />
      </ErrorBoundary>
      {settingsOpen && <SettingsOverlay onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}

export default App
