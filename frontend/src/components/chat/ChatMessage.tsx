import { Message } from './types';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[85%] px-4 py-2.5 rounded-2xl ${
          isUser
            ? 'bg-[var(--green-up)] text-[var(--bg-darkest)] rounded-br-md'
            : 'bg-[var(--bg-medium)] text-[var(--text-primary)] rounded-bl-md'
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>
        <span className={`text-xs mt-1 block ${
          isUser ? 'text-[var(--bg-dark)]/60' : 'text-[var(--text-tertiary)]'
        }`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
