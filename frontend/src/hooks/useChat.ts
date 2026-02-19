import { useState, useCallback, useRef } from 'react';
import { Message } from '../components/chat/types';
import { streamChat, ChatContext, UIAction } from '../api/client';
import { APIBacktestResult } from '../context';
import type { ActionType, PendingAction } from '../context/ActionConfirmationContext';

export interface UseChatOptions {
  apiKey: string;
  model: string;
  useOpenRouter?: boolean;
  serverProvider?: string | null;  // null = use custom apiKey
  onBacktestResult?: (result: APIBacktestResult) => void;
  onCustomCode?: (code: string) => void;
  /** Callback for UI actions from AI (widget changes, layout changes, etc.) */
  onUIAction?: (action: UIAction) => void;
  /** Current chart context (symbol, interval) for state-aware AI */
  context?: ChatContext;
  /** Request confirmation before executing AI actions */
  requestConfirmation?: (action: Omit<PendingAction, 'id'>) => Promise<{ approved: boolean; feedback?: string }>;
}

interface UseChatReturn {
  messages: Message[];
  isTyping: boolean;
  sendMessage: (content: string) => void;
  stopGeneration: () => void;
  clearMessages: () => void;
}

let msgCounter = 0;
function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${++msgCounter}`;
}

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'Welcome to thats_my_quant! I can help you backtest trading strategies, analyze performance, and explain strategy mechanics. Try a quick action or ask me anything.',
  timestamp: new Date(),
};

// Map tool names to action types for confirmation
const TOOL_ACTION_TYPES: Record<string, ActionType> = {
  tmq_backtest: 'backtest',
  tmq_backtest_custom: 'backtest',
  tmq_macro_backtest: 'backtest',
  tmq_indicator: 'indicator',
  tmq_set_widget: 'widget',
  tmq_set_layout: 'widget',
  tmq_set_symbol: 'widget',
  tmq_toggle_code_panel: 'widget',
  tmq_analyze: 'code',
};

// Human-readable action titles
const TOOL_TITLES: Record<string, string> = {
  tmq_backtest: 'Run Backtest',
  tmq_backtest_custom: 'Run Custom Backtest',
  tmq_macro_backtest: 'Run Macro Backtest',
  tmq_indicator: 'Apply Indicator',
  tmq_set_widget: 'Change Widget',
  tmq_set_layout: 'Change Layout',
  tmq_set_symbol: 'Change Symbol',
  tmq_toggle_code_panel: 'Toggle Code Panel',
  tmq_analyze: 'Run Analysis',
};

export function useChat({ apiKey, model, useOpenRouter = false, serverProvider = null, onBacktestResult, onCustomCode, onUIAction, context, requestConfirmation }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);
  const historyRef = useRef<Array<{ role: string; content: string }>>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const onBacktestResultRef = useRef(onBacktestResult);
  onBacktestResultRef.current = onBacktestResult;
  const onCustomCodeRef = useRef(onCustomCode);
  onCustomCodeRef.current = onCustomCode;
  const onUIActionRef = useRef(onUIAction);
  onUIActionRef.current = onUIAction;
  const requestConfirmationRef = useRef(requestConfirmation);
  requestConfirmationRef.current = requestConfirmation;
  // Store context in ref to avoid stale closures but keep it current
  const contextRef = useRef(context);
  contextRef.current = context;
  // Queue feedback message to be sent after current stream ends
  const pendingFeedbackRef = useRef<string | null>(null);

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsTyping(false);
  }, []);

  // Determine if we have a valid key (either custom or server provider)
  const hasValidKey = serverProvider || apiKey;

  const sendMessage = useCallback(async (content: string) => {
    if (!hasValidKey) {
      setMessages(prev => [...prev, {
        id: nextId('user'),
        role: 'user',
        content,
        timestamp: new Date(),
      }, {
        id: nextId('error'),
        role: 'assistant',
        content: 'Please select a provider or set your API key in the settings panel above to start chatting.',
        timestamp: new Date(),
      }]);
      return;
    }

    setMessages(prev => [...prev, {
      id: nextId('user'),
      role: 'user',
      content,
      timestamp: new Date(),
    }]);
    historyRef.current.push({ role: 'user', content });

    setIsTyping(true);
    const assistantId = nextId('assistant');
    let fullContent = '';
    let gotDone = false;

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }]);

    try {
      // Use server provider or custom API key
      const keyOrProvider = serverProvider || apiKey;
      const isServer = !!serverProvider;
      for await (const event of streamChat(historyRef.current, keyOrProvider, model, useOpenRouter, isServer, contextRef.current, signal)) {
        switch (event.type) {
          case 'text':
            if (event.content) {
              fullContent += event.content;
              const c = fullContent;
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: c } : m
              ));
            }
            break;

          case 'tool_call':
            if (event.name) {
              const name = event.name;
              const actionType = TOOL_ACTION_TYPES[name];

              // Request confirmation for supported action types
              if (actionType && requestConfirmationRef.current) {
                const title = TOOL_TITLES[name] || name;
                const args = event.args || {};

                // Build description based on tool type
                let description = `TMQ wants to ${title.toLowerCase()}`;
                if (args.symbol) description += ` for ${args.symbol}`;
                if (args.strategy) description += ` using ${args.strategy} strategy`;

                const { approved, feedback } = await requestConfirmationRef.current({
                  type: actionType,
                  title,
                  description,
                  details: args,
                  onApprove: () => {},
                  onReject: () => {},
                });

                if (!approved) {
                  // Abort the stream
                  abortControllerRef.current?.abort();

                  // Update message to show it was cancelled
                  setMessages(prev => prev.map(m =>
                    m.id === assistantId
                      ? { ...m, content: fullContent + `\n\n*${title} cancelled by user*`, toolStatus: undefined }
                      : m
                  ));

                  // Queue feedback to be sent after current stream ends
                  if (feedback) {
                    pendingFeedbackRef.current = feedback;
                  }

                  return; // Exit the streaming loop
                }
              }

              // Show running status (user approved or no confirmation needed)
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, toolStatus: { name, status: 'running' as const } }
                  : m
              ));

              // Extract code from tmq_backtest_custom calls
              if (name === 'tmq_backtest_custom' && event.args?.code) {
                onCustomCodeRef.current?.(event.args.code as string);
              }
            }
            break;

          case 'tool_result':
            if (event.name) {
              const name = event.name;
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, toolStatus: { name, status: 'complete' as const } }
                  : m
              ));

              // Handle backtest results
              if (
                (name === 'tmq_backtest' || name === 'tmq_backtest_custom') &&
                event.result
              ) {
                try {
                  const parsed = JSON.parse(event.result);
                  if (parsed.metrics && parsed.equity_curve) {
                    onBacktestResultRef.current?.(parsed as APIBacktestResult);
                  }
                } catch {
                  console.warn('Could not parse backtest result from tool_result');
                }
              }

              // Handle UI actions (widget changes, layout changes, etc.)
              if (event.result) {
                try {
                  const parsed = JSON.parse(event.result);
                  if (parsed._action) {
                    onUIActionRef.current?.(parsed as UIAction);
                  }
                } catch {
                  // Not JSON or not a UI action, ignore
                }
              }
            }
            break;

          case 'error':
            // Handle error events from the backend
            if (event.content) {
              const errorMsg = event.content;
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, content: fullContent ? `${fullContent}\n\n**Error:** ${errorMsg}` : `Error: ${errorMsg}`, toolStatus: undefined }
                  : m
              ));
            }
            break;

          case 'done':
            gotDone = true;
            setMessages(prev => prev.map(m =>
              m.id === assistantId ? { ...m, toolStatus: undefined } : m
            ));
            break;
        }
      }

      if (gotDone || fullContent) {
        historyRef.current.push({ role: 'assistant', content: fullContent });
      }
    } catch (err) {
      // Don't show error for user-initiated abort
      if (err instanceof Error && err.name === 'AbortError') {
        // Keep the partial content that was streamed
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: fullContent || '(stopped)', toolStatus: undefined } : m
        ));
      } else {
        const errorContent = err instanceof Error ? err.message : 'Failed to get response';
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: `Error: ${errorContent}`, toolStatus: undefined } : m
        ));
      }
    } finally {
      abortControllerRef.current = null;
      setIsTyping(false);

      // Process any queued feedback from rejected confirmations
      const feedback = pendingFeedbackRef.current;
      if (feedback) {
        pendingFeedbackRef.current = null;
        // Use setTimeout to avoid calling sendMessage while it's still finishing
        setTimeout(() => {
          // Add feedback as user message and trigger new AI response
          historyRef.current.push({ role: 'user', content: feedback });
          setMessages(prev => [...prev, {
            id: nextId('user'),
            role: 'user',
            content: feedback,
            timestamp: new Date(),
          }]);
          // Note: We don't auto-send here - user can see their feedback was queued
          // They can press Enter or click Send to trigger the AI response
        }, 100);
      }
    }
  }, [apiKey, model, useOpenRouter, serverProvider, hasValidKey]);

  const clearMessages = useCallback(() => {
    setMessages([WELCOME_MESSAGE]);
    historyRef.current = [];
  }, []);

  return { messages, isTyping, sendMessage, stopGeneration, clearMessages };
}
