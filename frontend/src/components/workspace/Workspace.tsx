import { useRef, useCallback } from 'react'
import { useWorkspace } from '../../context'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { WorkspacePane } from './WorkspacePane'
import { ChartGrid } from '../chart/ChartGrid'
import { ChatSidebarContent } from './ChatPaneContent'
import { CodePanelContent } from './CodePaneContent'
import { ResizeHandle } from '../chart/ResizeHandle'

export function Workspace() {
  const { panes, closePane } = useWorkspace()
  const workspaceRef = useRef<HTMLDivElement>(null)
  const mainRowRef = useRef<HTMLDivElement>(null)

  // Resizable ratios (persisted)
  const [codeRatio, setCodeRatio] = useLocalStorage('workspaceCodeRatio', 0.25)
  const [chatRatio, setChatRatio] = useLocalStorage('workspaceChatRatio', 0.3)

  const resetCodeRatio = useCallback(() => setCodeRatio(0.25), [setCodeRatio])
  const resetChatRatio = useCallback(() => setChatRatio(0.3), [setChatRatio])

  const chartPane = panes.find(p => p.type === 'chart')
  const chatPane = panes.find(p => p.type === 'chat')
  const codePane = panes.find(p => p.type === 'code')

  const hasCodePane = Boolean(codePane)
  const hasMainPanes = Boolean(chartPane) || Boolean(chatPane)
  const hasBothMainPanes = Boolean(chartPane) && Boolean(chatPane)

  // No panes at all
  if (!hasMainPanes && !hasCodePane) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--bg-darkest)]">
        <div className="text-center text-[var(--text-tertiary)]">
          <p className="text-lg mb-2">No panes open</p>
          <p className="text-sm">Use the + button in the top bar to add panes</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={workspaceRef} className="flex-1 flex flex-col min-h-0 relative">
      {/* Main content row (chart + chat) */}
      {hasMainPanes && (
        <div
          ref={mainRowRef}
          className="relative flex flex-row min-h-0"
          style={{ height: hasCodePane ? `${(1 - codeRatio) * 100}%` : '100%' }}
        >
          {/* Chart pane */}
          {chartPane && (
            <div
              className="min-w-0"
              style={{ width: hasBothMainPanes ? `${(1 - chatRatio) * 100}%` : '100%' }}
            >
              <WorkspacePane
                id={chartPane.id}
                title="Chart"
                onClose={() => closePane(chartPane.id)}
              >
                <ChartGrid />
              </WorkspacePane>
            </div>
          )}

          {/* Resize handle between chart and chat */}
          {hasBothMainPanes && (
            <ResizeHandle
              direction="vertical"
              ratio={1 - chatRatio}
              onRatioChange={(r) => setChatRatio(1 - r)}
              onReset={resetChatRatio}
              containerRef={mainRowRef}
            />
          )}

          {/* Chat pane */}
          {chatPane && (
            <div
              className="min-w-0"
              style={{ width: hasBothMainPanes ? `${chatRatio * 100}%` : '100%' }}
            >
              <WorkspacePane
                id={chatPane.id}
                title="Chat"
                onClose={() => closePane(chatPane.id)}
              >
                <ChatSidebarContent />
              </WorkspacePane>
            </div>
          )}
        </div>
      )}

      {/* Resize handle between main row and code */}
      {hasMainPanes && hasCodePane && (
        <ResizeHandle
          direction="horizontal"
          ratio={1 - codeRatio}
          onRatioChange={(r) => setCodeRatio(1 - r)}
          onReset={resetCodeRatio}
          containerRef={workspaceRef}
        />
      )}

      {/* Code pane */}
      {codePane && (
        <div
          className="min-h-0"
          style={{ height: hasMainPanes ? `${codeRatio * 100}%` : '100%' }}
        >
          <WorkspacePane
            id={codePane.id}
            title="Code"
            onClose={() => closePane(codePane.id)}
          >
            <CodePanelContent />
          </WorkspacePane>
        </div>
      )}
    </div>
  )
}
