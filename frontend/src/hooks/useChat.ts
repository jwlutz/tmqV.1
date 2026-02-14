import { useState, useCallback } from 'react';
import { Message } from '../components/chat/types';

interface UseChatOptions {
  initialMessages?: Message[];
  onSend?: (message: string) => void;
}

interface UseChatReturn {
  messages: Message[];
  isTyping: boolean;
  sendMessage: (content: string) => void;
  clearMessages: () => void;
}

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'Welcome to thats_my_quant! I can help you backtest trading strategies, analyze performance, and explain strategy mechanics. Try a quick action or ask me anything.',
  timestamp: new Date(),
};

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>(
    options.initialMessages ?? [WELCOME_MESSAGE]
  );
  const [isTyping, setIsTyping] = useState(false);

  const sendMessage = useCallback((content: string) => {
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    options.onSend?.(content);

    setIsTyping(true);

    const response = generateMockResponse(content);
    const delay = 800 + Math.random() * 1200;

    setTimeout(() => {
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    }, delay);
  }, [options.onSend]);

  const clearMessages = useCallback(() => {
    setMessages([WELCOME_MESSAGE]);
  }, []);

  return { messages, isTyping, sendMessage, clearMessages };
}

function generateMockResponse(userMessage: string): string {
  const lower = userMessage.toLowerCase();

  if (lower.includes('backtest')) {
    return `Running momentum backtest on BTC/USDT...

**Results Summary:**
\u2022 **Sharpe Ratio:** 1.42
\u2022 **CAGR:** 28.5%
\u2022 **Max Drawdown:** -18.3%
\u2022 **Win Rate:** 58%
\u2022 **Total Trades:** 127

The strategy shows solid risk-adjusted returns. Switch to Backtest mode to see the full equity curve.`;
  }

  if (lower.includes('stats') || lower.includes('statistics') || lower.includes('performance')) {
    return `**Performance Statistics (2020-2024):**

| Metric | Value |
|--------|-------|
| Total Return | 342% |
| Annualized Return | 28.5% |
| Sharpe Ratio | 1.42 |
| Sortino Ratio | 2.15 |
| Max Drawdown | -18.3% |
| Win Rate | 58% |
| Profit Factor | 1.87 |

Would you like me to explain any of these metrics?`;
  }

  if (lower.includes('explain') || lower.includes('how') || lower.includes('work')) {
    return `**Momentum Strategy Overview:**

This strategy identifies trending assets and trades in the direction of the trend.

**Entry Rules:**
\u2022 RSI crosses above 50 (bullish momentum)
\u2022 Price above 20-day moving average
\u2022 Volume confirmation (above average)

**Exit Rules:**
\u2022 RSI crosses below 50
\u2022 Stop loss at -5%
\u2022 Take profit at +15%

The key insight is that momentum tends to persist in crypto markets, making this a robust approach.`;
  }

  if (lower.includes('parameter') || lower.includes('adjust') || lower.includes('setting') || lower.includes('optimize')) {
    return `**Adjustable Parameters:**

\u2022 **RSI Period:** 14 (default) \u2014 Range: 5-30
\u2022 **MA Period:** 20 (default) \u2014 Range: 10-50
\u2022 **Stop Loss:** -5% \u2014 Range: -2% to -10%
\u2022 **Take Profit:** +15% \u2014 Range: +5% to +30%
\u2022 **Position Size:** 100% \u2014 Range: 10% to 100%

To optimize parameters, say "optimize RSI period from 10 to 20".`;
  }

  return `I understand you're asking about "${userMessage.slice(0, 50)}${userMessage.length > 50 ? '...' : ''}".

Here's what I can help with:
\u2022 **Run backtests** \u2014 Test strategies on historical data
\u2022 **Show statistics** \u2014 View performance metrics
\u2022 **Explain strategies** \u2014 Understand how they work
\u2022 **Adjust parameters** \u2014 Fine-tune strategy settings

What would you like to explore?`;
}
