import { renderHook, act } from '@testing-library/react';
import { useChat } from '../useChat';

test('starts with welcome message', () => {
  const { result } = renderHook(() => useChat());
  expect(result.current.messages).toHaveLength(1);
  expect(result.current.messages[0].role).toBe('assistant');
});

test('sendMessage adds user message', () => {
  const { result } = renderHook(() => useChat());

  act(() => {
    result.current.sendMessage('hello');
  });

  expect(result.current.messages).toHaveLength(2);
  expect(result.current.messages[1].content).toBe('hello');
  expect(result.current.isTyping).toBe(true);
});

test('clearMessages resets to welcome', () => {
  const { result } = renderHook(() => useChat());

  act(() => {
    result.current.sendMessage('hello');
  });

  expect(result.current.messages).toHaveLength(2);

  act(() => {
    result.current.clearMessages();
  });

  expect(result.current.messages).toHaveLength(1);
  expect(result.current.messages[0].id).toBe('welcome');
});

test('accepts custom initial messages', () => {
  const custom = [
    { id: 'custom-1', role: 'assistant' as const, content: 'Custom welcome', timestamp: new Date() },
  ];
  const { result } = renderHook(() => useChat({ initialMessages: custom }));
  expect(result.current.messages).toHaveLength(1);
  expect(result.current.messages[0].content).toBe('Custom welcome');
});

test('calls onSend callback', () => {
  const onSend = vi.fn();
  const { result } = renderHook(() => useChat({ onSend }));

  act(() => {
    result.current.sendMessage('test message');
  });

  expect(onSend).toHaveBeenCalledWith('test message');
});
