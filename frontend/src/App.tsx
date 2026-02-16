import { useEffect, useRef, useCallback } from 'react'
import './App.css'
import { AppProvider, useMode, useSettingsOverlay } from './context'
import { TopBar, MainPanel, ChatSidebar } from './components/layout'
import { SettingsOverlay } from './components/settings'
import { ErrorBoundary } from './components/ui'
import { ResizeHandle } from './components/chart/ResizeHandle'
import { useLocalStorage } from './hooks/useLocalStorage'

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
  const contentRef = useRef<HTMLDivElement>(null)
  const [chatRatio, setChatRatio] = useLocalStorage('chatPanelRatio', 0.25)
  const resetChat = useCallback(() => setChatRatio(0.25), [])

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <div ref={contentRef} className="flex-1 flex flex-row min-h-0 relative">
        <ErrorBoundary>
          <MainPanel style={{ width: `${(1 - chatRatio) * 100}%` }} />
        </ErrorBoundary>
        <ErrorBoundary>
          <ChatSidebar style={{ width: `${chatRatio * 100}%` }} />
        </ErrorBoundary>
        <ResizeHandle
          direction="vertical"
          ratio={1 - chatRatio}
          onRatioChange={(r) => setChatRatio(1 - r)}
          onReset={resetChat}
          containerRef={contentRef}
          className="absolute z-50"
        />
      </div>
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
