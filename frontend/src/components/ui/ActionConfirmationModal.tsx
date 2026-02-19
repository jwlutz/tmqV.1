import { useState, useRef } from 'react';
import { useActionConfirmation, ActionType } from '../../context/ActionConfirmationContext';

const ACTION_ICONS: Record<ActionType, string> = {
  backtest: '\u{1F9EA}', // test tube
  indicator: '\u{1F4C8}', // chart
  widget: '\u{1F5BC}',   // frame
  code: '\u{1F4BB}',     // laptop
};

const ACTION_LABELS: Record<ActionType, string> = {
  backtest: 'Run Backtest',
  indicator: 'Apply Indicator',
  widget: 'Modify Widget',
  code: 'Execute Code',
};

export function ActionConfirmationModal() {
  const { pendingAction, setAutoApprove } = useActionConfirmation();
  const [feedback, setFeedback] = useState('');
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const feedbackRef = useRef<HTMLDivElement>(null);

  if (!pendingAction) return null;

  const handleApprove = () => {
    if (dontAskAgain) {
      setAutoApprove(pendingAction.type, true);
    }
    pendingAction.onApprove();
    setFeedback('');
    setDontAskAgain(false);
  };

  const handleReject = () => {
    pendingAction.onReject(feedback || undefined);
    setFeedback('');
    setDontAskAgain(false);
  };

  const handleFeedbackSubmit = () => {
    if (feedback.trim()) {
      pendingAction.onReject(feedback.trim());
      setFeedback('');
      setDontAskAgain(false);
    }
  };

  // Click on card approves (unless clicking feedback area)
  const handleCardClick = (e: React.MouseEvent) => {
    if (feedbackRef.current?.contains(e.target as Node)) {
      return;
    }
    handleApprove();
  };

  return (
    <>
      {/* Subtle backdrop - click to cancel */}
      <div
        className="fixed inset-0 z-[99] bg-black/30"
        onClick={handleReject}
      />

      {/* Inline prompt above chatbox - positioned at bottom */}
      <div className="fixed bottom-20 left-0 right-0 z-[100] flex justify-center px-4 pointer-events-none">
        <div
          onClick={handleCardClick}
          className="pointer-events-auto bg-[var(--bg-dark)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-md overflow-hidden cursor-pointer hover:border-[var(--green-up)]/50 transition-all animate-in slide-in-from-bottom-4 duration-200"
        >
          {/* Compact header */}
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-xl">{ACTION_ICONS[pendingAction.type]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                {ACTION_LABELS[pendingAction.type]}?
              </p>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                {pendingAction.description}
              </p>
            </div>
            {/* Click hint */}
            <div className="text-xs text-[var(--green-up)] bg-[var(--green-up)]/10 px-2 py-1 rounded shrink-0">
              click to run
            </div>
          </div>

          {/* Details (collapsed by default, show key params) */}
          {Object.keys(pendingAction.details).length > 0 && (
            <div className="px-4 pb-2 flex flex-wrap gap-2">
              {Object.entries(pendingAction.details).slice(0, 3).map(([key, value]) => (
                <span key={key} className="text-xs bg-[var(--bg-medium)] px-2 py-0.5 rounded text-[var(--text-tertiary)]">
                  {key}: <span className="text-[var(--text-primary)]">{String(value)}</span>
                </span>
              ))}
            </div>
          )}

          {/* Feedback input - doesn't trigger approve */}
          <div
            ref={feedbackRef}
            onClick={(e) => e.stopPropagation()}
            className="px-4 py-2 border-t border-[var(--border)] bg-[var(--bg-darkest)] cursor-default"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Or type feedback..."
                className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--bg-medium)] border border-[var(--border)]
                           text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)]
                           focus:outline-none focus:border-[var(--green-up)]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && feedback.trim()) {
                    handleFeedbackSubmit();
                  }
                  if (e.key === 'Escape') {
                    handleReject();
                  }
                }}
              />
              <button
                onClick={handleFeedbackSubmit}
                disabled={!feedback.trim()}
                className="px-3 py-1.5 rounded-lg bg-[var(--bg-medium)] text-[var(--text-primary)]
                           text-sm hover:bg-white/10 transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Send
              </button>
              <label
                className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--text-tertiary)]"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={dontAskAgain}
                  onChange={(e) => setDontAskAgain(e.target.checked)}
                  className="w-3 h-3 rounded border-[var(--border)] bg-[var(--bg-darkest)]
                             text-[var(--green-up)] focus:ring-0"
                />
                Don't ask
              </label>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
