import { useState, useCallback } from 'react'
import Editor from '@monaco-editor/react'

interface AdvancedSectionProps {
  rawEnv: string
  onSave: (raw: string) => Promise<void>
  onRefresh: () => Promise<void>
}

export function AdvancedSection({ rawEnv, onSave, onRefresh }: AdvancedSectionProps) {
  const [localContent, setLocalContent] = useState(rawEnv)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEditorChange = useCallback((value: string | undefined) => {
    const newValue = value || ''
    setLocalContent(newValue)
    setHasChanges(newValue !== rawEnv)
    setError(null)

    // Basic validation
    const lines = newValue.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line && !line.startsWith('#') && !line.includes('=')) {
        setError(`Line ${i + 1}: Invalid syntax - missing '=' in "${line.substring(0, 30)}${line.length > 30 ? '...' : ''}"`)
        break
      }
    }
  }, [rawEnv])

  const handleSave = async () => {
    if (error) return

    setIsSaving(true)
    try {
      await onSave(localContent)
      setHasChanges(false)
    } catch {
      // Error handled by hook
    } finally {
      setIsSaving(false)
    }
  }

  const handleRefresh = async () => {
    await onRefresh()
    setLocalContent(rawEnv)
    setHasChanges(false)
    setError(null)
  }

  const handleReset = () => {
    setLocalContent(rawEnv)
    setHasChanges(false)
    setError(null)
  }

  return (
    <div className="space-y-4">
      {/* Warning */}
      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
        <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-amber-400">Warning</p>
          <p className="text-sm text-amber-300/80 mt-1">
            This is a raw editor for your <code className="bg-amber-500/20 px-1 rounded">.env</code> file.
            Invalid syntax may break the application. Use with caution.
          </p>
        </div>
      </div>

      {/* Editor */}
      <div className="border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="h-[400px]">
          <Editor
            height="100%"
            defaultLanguage="ini"
            theme="vs-dark"
            value={localContent}
            onChange={handleEditorChange}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: 'monospace',
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              tabSize: 2,
              renderLineHighlight: 'all',
              padding: { top: 12, bottom: 12 }
            }}
          />
        </div>
      </div>

      {/* Validation error */}
      {error && (
        <div className="p-3 bg-[var(--red-down)]/10 border border-[var(--red-down)]/30 rounded-lg text-sm text-[var(--red-down)]">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving || !!error || !hasChanges}
            className="px-4 py-2 bg-[var(--green-up)] rounded-lg text-sm font-medium text-[var(--bg-darkest)] hover:bg-[var(--green-up)]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={handleReset}
            disabled={!hasChanges}
            className="px-4 py-2 bg-white/5 border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--text-primary)] hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Reset
          </button>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-white/5 border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--text-primary)] hover:bg-white/10 transition-colors"
          >
            Refresh from Disk
          </button>
        </div>

        {hasChanges && !error && (
          <span className="text-sm text-amber-400">Unsaved changes</span>
        )}
      </div>

      {/* Help */}
      <div className="p-4 bg-[var(--bg-dark)] rounded-lg border border-[var(--border)]">
        <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2">Format Reference</h4>
        <pre className="text-xs text-[var(--text-secondary)] font-mono whitespace-pre-wrap">
{`# Comments start with #
KEY_NAME=value
ANOTHER_KEY=another_value

# Common keys:
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...
ALPACA_API_KEY=...
ALPACA_SECRET_KEY=...
FRED_API_KEY=...`}
        </pre>
      </div>
    </div>
  )
}
