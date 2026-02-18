import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useBacktest, useChatSettings, useCodePanel, useChartLayout, useInterval } from '../../context';
import { useChat } from '../../hooks';
import { ChatMessage, ChatInput, QuickActions, TypingIndicator } from '../chat';
import { ChatContext } from '../../api/client';

// Default models for each provider (must match litellm model names)
const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
  google: 'gemini-2.0-flash',
  xai: 'grok-2',
  openrouter: 'anthropic/claude-haiku-4.5',
};

export function ChatSidebarContent() {
  const { setBacktestResult } = useBacktest();
  const {
    apiKey, model,
    useOpenRouter, openRouterApiKey, openRouterModel,
    selectedServerProvider
  } = useChatSettings();

  // Get active pane context for state-aware AI
  const { panes, activePaneId } = useChartLayout();
  const { interval } = useInterval();
  const activePane = panes.find(p => p.id === activePaneId);

  // Build chat context from active pane state
  const chatContext: ChatContext = useMemo(() => ({
    symbol: activePane?.symbol,
    interval: interval,
    widgetType: activePane?.widgetType,
  }), [activePane?.symbol, activePane?.widgetType, interval]);

  // Compute effective API key and model based on provider selection
  const effectiveApiKey = useOpenRouter ? openRouterApiKey : apiKey;
  const effectiveUseOpenRouter = selectedServerProvider === 'openrouter' || useOpenRouter;

  const effectiveModel = effectiveUseOpenRouter
    ? openRouterModel
    : (selectedServerProvider
        ? PROVIDER_DEFAULT_MODELS[selectedServerProvider] || model
        : model);

  const { setCodePanelOpen, setSandboxCode } = useCodePanel();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleCustomCode = useCallback((code: string) => {
    setSandboxCode(code);
    setCodePanelOpen(true);
  }, [setSandboxCode, setCodePanelOpen]);

  const { messages, isTyping, sendMessage } = useChat({
    apiKey: effectiveApiKey,
    model: effectiveModel,
    useOpenRouter: effectiveUseOpenRouter,
    serverProvider: selectedServerProvider,
    onBacktestResult: setBacktestResult,
    onCustomCode: handleCustomCode,
    context: chatContext,
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleAction = (message: string) => {
    sendMessage(message);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-dark)]">
      <QuickActions onAction={handleAction} disabled={isTyping} />

      <div className="flex-1 overflow-y-auto p-3">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSend={sendMessage} disabled={isTyping} />
    </div>
  );
}
