import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useActionConfirmation } from '../../context/ActionConfirmationContext';

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  isTyping?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, onStop, isTyping = false, disabled = false, placeholder = 'Ask about your strategy...' }: ChatInputProps) {
  const [input, setInput] = useState('');
  const { preferences, setMode } = useActionConfirmation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [input]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (trimmed && !disabled && !isTyping) {
      onSend(trimmed);
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      if (isTyping && onStop) {
        onStop();
      } else {
        setInput('');
        e.currentTarget.blur();
      }
    }
  };

  return (
    <div className="border-t border-[var(--border)] p-3 space-y-2">
      <div className="flex items-end gap-2 bg-[var(--bg-medium)] rounded-xl p-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          aria-label="Chat message input"
          rows={1}
          className="flex-1 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-tertiary)]
                     text-sm resize-none outline-none min-h-[24px] max-h-[300px] py-1 px-2
                     overflow-y-auto"
        />
        {isTyping ? (
          <button
            onClick={onStop}
            className="p-2 rounded-lg bg-[var(--red-down)] text-white
                       hover:brightness-110 transition-all"
            aria-label="Stop generation"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={disabled || !input.trim()}
            className="p-2 rounded-lg bg-[var(--green-up)] text-[var(--bg-darkest)]
                       disabled:opacity-40 disabled:cursor-not-allowed
                       hover:brightness-110 transition-all"
            aria-label="Send message"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        )}
      </div>

      {/* Execution mode toggle */}
      <div className="flex items-center justify-center gap-1 text-xs">
        <button
          onClick={() => setMode('ask')}
          className={`px-2 py-0.5 rounded transition-colors ${
            preferences.mode === 'ask'
              ? 'bg-[var(--green-up)]/20 text-[var(--green-up)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
        >
          Ask
        </button>
        <span className="text-[var(--text-tertiary)]">/</span>
        <button
          onClick={() => setMode('auto')}
          className={`px-2 py-0.5 rounded transition-colors ${
            preferences.mode === 'auto'
              ? 'bg-[var(--green-up)]/20 text-[var(--green-up)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
        >
          Auto
        </button>
      </div>
    </div>
  );
}
