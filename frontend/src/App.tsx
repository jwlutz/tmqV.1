import { useEffect } from 'react'
import './App.css'
import { AppProvider, useMode } from './context'
import { TopBar, MainPanel, ChatSidebar } from './components/layout'
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

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <div className="flex-1 flex flex-row min-h-0">
        <ErrorBoundary>
          <MainPanel />
        </ErrorBoundary>
        <ErrorBoundary>
          <ChatSidebar />
        </ErrorBoundary>
      </div>
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
