import { useState, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import { useBacktest, APIBacktestResult } from '../../context'
import { runCustomBacktest, submitFeatureRequest } from '../../api/client'
import { getActiveChartState } from '../../hooks/useActiveChartState'

interface CodeTabContentProps {
  tabId: string
}

const DEFAULT_CODE = `#  _____ _           _   _       __  __          ___                   _
# |_   _| |__   __ _| |_( )___  |  \\/  |_   _   / _ \\ _   _  __ _ _ __ | |_
#   | | | '_ \\ / _\` | __|// __| | |\\/| | | | | | | | | | | |/ _\` | '_ \\| __|
#   | | | | | | (_| | |_  \\__ \\ | |  | | |_| | | |_| | |_| | (_| | | | | |_
#   |_| |_| |_|\\__,_|\\__| |___/ |_|  |_|\\__, |  \\__\\_\\\\__,_|\\__,_|_| |_|\\__|
#                                       |___/
#
# Custom scripting coming soon...
# Request a feature: type /request <your idea> and hit Run
#
`

function getStorageKey(tabId: string) {
  return `code-tab-${tabId}`
}

function loadTabCode(tabId: string): string {
  try {
    const saved = localStorage.getItem(getStorageKey(tabId))
    if (saved) return saved
  } catch (e) {
    console.warn('Failed to load code tab state:', e)
  }
  return DEFAULT_CODE
}

function saveTabCode(tabId: string, code: string) {
  try {
    localStorage.setItem(getStorageKey(tabId), code)
  } catch (e) {
    console.warn('Failed to save code tab state:', e)
  }
}

function getDateRange(interval: string): { start: string; end: string } {
  const now = new Date()
  const end = now.toISOString().split('T')[0]
  let daysBack: number
  switch (interval) {
    case '1m': case '5m': daysBack = 2; break
    case '15m': case '30m': daysBack = 7; break
    case '1h': case '4h': daysBack = 30; break
    case '1d': daysBack = 365; break
    case '1wk': daysBack = 3 * 365; break
    case '1mo': daysBack = 10 * 365; break
    default: daysBack = 365
  }
  const startDate = new Date(now.getTime() - daysBack * 86400000)
  return { start: startDate.toISOString().split('T')[0], end }
}

export function CodeTabContent({ tabId }: CodeTabContentProps) {
  const [code, setCode] = useState(() => loadTabCode(tabId))
  const { setBacktestResult } = useBacktest()
  const [isRunning, setIsRunning] = useState(false)
  const [lastMetrics, setLastMetrics] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Read fresh state from window registry at render time
  const chartState = getActiveChartState()
  const activeSymbol = chartState.symbol
  const interval = chartState.interval

  const handleCodeChange = useCallback((value: string | undefined) => {
    const newCode = value || ''
    setCode(newCode)
    saveTabCode(tabId, newCode)
  }, [tabId])

  const handleRun = useCallback(async () => {
    if (isRunning) return
    setIsRunning(true)
    setError(null)
    setLastMetrics(null)

    try {
      const requestMatch = code.match(/^\/request\s+(.+)/s)
      if (requestMatch) {
        const message = requestMatch[1].trim()
        const result = await submitFeatureRequest(message)
        if (result.success) {
          setLastMetrics('Request submitted! Thanks for the feedback.')
        } else {
          setError(result.error || 'Failed to submit request')
        }
        return
      }

      const apiSymbol = activeSymbol.replace('-', '/')
      const { start, end } = getDateRange(interval)
      const result: APIBacktestResult = await runCustomBacktest(apiSymbol, code, start, end)

      setBacktestResult(result)

      const m = result.metrics
      const parts: string[] = []
      if (m.sharpe != null) parts.push(`Sharpe: ${m.sharpe.toFixed(2)}`)
      if (m.total_return != null) parts.push(`Return: ${(m.total_return * 100).toFixed(1)}%`)
      if (m.total_trades != null) parts.push(`${m.total_trades} trades`)
      setLastMetrics(parts.join(' | '))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backtest failed')
    } finally {
      setIsRunning(false)
    }
  }, [code, activeSymbol, interval, isRunning, setBacktestResult])

  return (
    <div className="flex flex-col h-full bg-[var(--bg-dark)]">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border)] bg-[var(--bg-darker)]">
        <div className="flex items-center gap-2">
          {lastMetrics && (
            <span className="text-xs font-mono text-[var(--green-up)]">{lastMetrics}</span>
          )}
          {error && (
            <span className="text-xs font-mono text-[var(--red-down)] truncate max-w-[200px]">{error}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-tertiary)] font-mono">{activeSymbol}</span>
          <button
            onClick={handleRun}
            disabled={isRunning}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              isRunning
                ? 'bg-white/5 text-[var(--text-tertiary)] cursor-not-allowed'
                : 'bg-[var(--green-up)] text-[var(--bg-darkest)] hover:brightness-110'
            }`}
          >
            {isRunning ? (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Running
              </span>
            ) : (
              'Run \u25B6'
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          defaultLanguage="python"
          value={code}
          onChange={handleCodeChange}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            wordWrap: 'on',
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            padding: { top: 8 },
            renderLineHighlight: 'none',
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
          }}
        />
      </div>
    </div>
  )
}
