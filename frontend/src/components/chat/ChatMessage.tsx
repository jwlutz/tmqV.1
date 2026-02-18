import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        ) : (
          <div className="text-sm leading-relaxed prose prose-sm prose-invert max-w-none
                          prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
                          prose-headings:mt-2 prose-headings:mb-1
                          prose-code:bg-black/20 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                          prose-pre:bg-black/30 prose-pre:p-2 prose-pre:rounded-lg
                          prose-strong:text-[var(--text-primary)]
                          prose-table:border-collapse prose-table:text-xs
                          prose-th:bg-black/30 prose-th:px-2 prose-th:py-1 prose-th:border prose-th:border-white/10
                          prose-td:px-2 prose-td:py-1 prose-td:border prose-td:border-white/10">
            <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
          </div>
        )}
        <span className={`text-xs mt-1 block ${
          isUser ? 'text-[var(--bg-dark)]/60' : 'text-[var(--text-tertiary)]'
        }`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
