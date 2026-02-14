import { useState, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled = false, placeholder = 'Ask about your strategy...' }: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    const trimmed = input.trim();
    if (trimmed && !disabled) {
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
      setInput('');
      e.currentTarget.blur();
    }
  };

  return (
    <div className="border-t border-[var(--border)] p-3">
      <div className="flex items-end gap-2 bg-[var(--bg-medium)] rounded-xl p-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          aria-label="Chat message input"
          rows={1}
          className="flex-1 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-tertiary)]
                     text-sm resize-none outline-none min-h-[24px] max-h-[120px] py-1 px-2"
          style={{ height: 'auto' }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className="p-2 rounded-lg bg-[var(--green-up)] text-[var(--bg-darkest)]
                     disabled:opacity-40 disabled:cursor-not-allowed
                     hover:brightness-110 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
