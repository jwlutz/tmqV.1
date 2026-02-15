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
        {message.toolStatus && (
          <div className="flex items-center gap-1.5 mb-1 text-xs text-[var(--text-secondary)]">
            {message.toolStatus.status === 'running' ? (
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--green-up)]" />
            )}
            <span className="font-mono">
              {message.toolStatus.status === 'running' ? 'Running' : 'Ran'} {message.toolStatus.name}
            </span>
          </div>
        )}
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
