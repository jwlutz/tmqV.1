import { useState, useRef, useEffect } from 'react';
import { useMode, useBacktest, useChatSettings } from '../../context';
import { useChat } from '../../hooks';
import { ChatMessage, ChatInput, QuickActions, TypingIndicator } from '../chat';

export function ChatSidebar() {
  const { mode } = useMode();
  const { setBacktestResult } = useBacktest();
  const { apiKey, model } = useChatSettings();
  const { messages, isTyping, sendMessage } = useChat({
    apiKey,
    model,
    onBacktestResult: setBacktestResult,
  });
  const [isOpen, setIsOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleAction = (message: string) => {
    sendMessage(message);
  };

  return (
    <>
      {/* Mobile toggle FAB */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle chat sidebar"
        className="lg:hidden fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full
                   bg-[var(--green-up)] text-[var(--bg-darkest)] shadow-lg
                   flex items-center justify-center text-xl"
      >
        &#128172;
      </button>

      {/* Sidebar */}
      <div className={`
        fixed lg:relative inset-y-0 right-0 z-40
        w-[350px] flex-none bg-[var(--bg-dark)] border-l border-[var(--border)]
        flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
      `}>
        {/* Mobile close button */}
        <button
          onClick={() => setIsOpen(false)}
          aria-label="Close chat sidebar"
          className="lg:hidden absolute top-3 right-3 z-10 p-1 text-[var(--text-secondary)]
                     hover:text-[var(--text-primary)] transition-colors"
        >
          &#10005;
        </button>

        <div className="p-3 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="font-semibold text-[var(--text-primary)]">Chat</h2>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            mode === 'live'
              ? 'bg-[var(--green-up)]/20 text-[var(--green-up)]'
              : 'bg-[var(--text-secondary)]/20 text-[var(--text-secondary)]'
          }`}>
            {mode === 'live' ? '\u25CF Live' : '\u25C9 Backtest'}
          </span>
        </div>

        <QuickActions onAction={handleAction} disabled={isTyping} />

        <div className="flex-1 overflow-y-auto p-3">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        <ChatInput onSend={sendMessage} disabled={isTyping} />
      </div>

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          data-testid="chat-backdrop"
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
