export function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="bg-[var(--bg-medium)] px-4 py-3 rounded-2xl rounded-bl-md">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-[var(--text-tertiary)] rounded-full animate-bounce"
                style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-[var(--text-tertiary)] rounded-full animate-bounce"
                style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-[var(--text-tertiary)] rounded-full animate-bounce"
                style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
