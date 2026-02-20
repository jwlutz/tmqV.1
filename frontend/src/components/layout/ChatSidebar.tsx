import { useState, useRef, useEffect, useCallback } from 'react';
import { useChatWithUIActions } from '../../hooks';
import { ChatMessage, ChatInput, QuickActions, TypingIndicator } from '../chat';

export function ChatSidebar({ style }: { style?: React.CSSProperties }) {
  const { messages, isTyping, sendMessage, stopGeneration } = useChatWithUIActions();
  const [isOpen, setIsOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  // Check if user is near the bottom of the scroll container
  const checkIfNearBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return true;
    const threshold = 100; // px from bottom
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  // Update near-bottom state on scroll
  const handleScroll = useCallback(() => {
    isNearBottomRef.current = checkIfNearBottom();
  }, [checkIfNearBottom]);

  // Auto-scroll to bottom only if user is near bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

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
      <div
        className={`
          fixed lg:relative inset-y-0 right-0 z-40
          flex-none bg-[var(--bg-dark)] border-l border-[var(--border)]
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}
        style={style}
      >
        {/* Mobile close button */}
        <button
          onClick={() => setIsOpen(false)}
          aria-label="Close chat sidebar"
          className="lg:hidden absolute top-3 right-3 z-10 p-1 text-[var(--text-secondary)]
                     hover:text-[var(--text-primary)] transition-colors"
        >
          &#10005;
        </button>

        <div className="p-3 border-b border-[var(--border)]">
          <h2 className="font-semibold text-[var(--text-primary)]">Chat</h2>
        </div>

        <QuickActions onAction={sendMessage} disabled={isTyping} />

        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-3"
        >
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        <ChatInput onSend={sendMessage} onStop={stopGeneration} isTyping={isTyping} />
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
