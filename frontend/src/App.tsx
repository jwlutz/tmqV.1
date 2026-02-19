import './App.css'
import { AppProvider, useSettingsOverlay } from './context'
import { ActionConfirmationProvider } from './context/ActionConfirmationContext'
import { TopBar } from './components/layout'
import { FlexWorkspace } from './components/workspace'
import { SettingsOverlay } from './components/settings'
import { ErrorBoundary, ActionConfirmationModal } from './components/ui'

function AppContent() {
  const { settingsOpen, setSettingsOpen } = useSettingsOverlay()

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <ErrorBoundary>
        <FlexWorkspace />
      </ErrorBoundary>
      {settingsOpen && <SettingsOverlay onClose={() => setSettingsOpen(false)} />}
      <ActionConfirmationModal />
    </div>
  )
}

function App() {
  return (
    <AppProvider>
      <ActionConfirmationProvider>
        <AppContent />
      </ActionConfirmationProvider>
    </AppProvider>
  )
}

export default App
