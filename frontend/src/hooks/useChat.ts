import { useState, useCallback, useRef } from 'react';
import { Message } from '../components/chat/types';
import { streamChat } from '../api/client';
import { APIBacktestResult } from '../context';

export interface UseChatOptions {
  apiKey: string;
  model: string;
  onBacktestResult?: (result: APIBacktestResult) => void;
  onCustomCode?: (code: string) => void;
}

interface UseChatReturn {
  messages: Message[];
  isTyping: boolean;
  sendMessage: (content: string) => void;
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

export function useChat({ apiKey, model, onBacktestResult, onCustomCode }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);
  const historyRef = useRef<Array<{ role: string; content: string }>>([]);
  const onBacktestResultRef = useRef(onBacktestResult);
  onBacktestResultRef.current = onBacktestResult;
  const onCustomCodeRef = useRef(onCustomCode);
  onCustomCodeRef.current = onCustomCode;

  const sendMessage = useCallback(async (content: string) => {
    if (!apiKey) {
      setMessages(prev => [...prev, {
        id: nextId('user'),
        role: 'user',
        content,
        timestamp: new Date(),
      }, {
        id: nextId('error'),
        role: 'assistant',
        content: 'Please set your API key in the settings panel above to start chatting.',
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

    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }]);

    try {
      for await (const event of streamChat(historyRef.current, apiKey, model)) {
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
      const errorContent = err instanceof Error ? err.message : 'Failed to get response';
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: `Error: ${errorContent}`, toolStatus: undefined } : m
      ));
    } finally {
      setIsTyping(false);
    }
  }, [apiKey, model]);

  const clearMessages = useCallback(() => {
    setMessages([WELCOME_MESSAGE]);
    historyRef.current = [];
  }, []);

  return { messages, isTyping, sendMessage, clearMessages };
}
