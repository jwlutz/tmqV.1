import './App.css'
import { AppProvider, useSettingsOverlay } from './context'
import { TopBar } from './components/layout'
import { FlexWorkspace } from './components/workspace'
import { SettingsOverlay } from './components/settings'
import { ErrorBoundary } from './components/ui'

function AppContent() {
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
