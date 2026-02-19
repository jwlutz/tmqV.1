import { useRef, useEffect } from 'react';
import { useChatWithUIActions } from '../../hooks';
import { ChatMessage, ChatInput, QuickActions, TypingIndicator } from '../chat';

export function ChatSidebarContent() {
  const { messages, isTyping, sendMessage, stopGeneration } = useChatWithUIActions();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-dark)]">
      <QuickActions onAction={sendMessage} disabled={isTyping} />

      <div className="flex-1 overflow-y-auto p-3">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSend={sendMessage} onStop={stopGeneration} isTyping={isTyping} />
    </div>
  );
}
