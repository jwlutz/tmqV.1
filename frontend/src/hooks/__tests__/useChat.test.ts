import { renderHook, act } from '@testing-library/react';
import { useChat } from '../useChat';

const defaultOptions = { apiKey: '', model: 'gpt-4o-mini' };

test('starts with welcome message', () => {
  const { result } = renderHook(() => useChat(defaultOptions));
  expect(result.current.messages).toHaveLength(1);
  expect(result.current.messages[0].role).toBe('assistant');
});

test('sendMessage adds user message when no API key', () => {
  const { result } = renderHook(() => useChat(defaultOptions));

  act(() => {
    result.current.sendMessage('hello');
  });

  // With no API key, it adds the user message + an error message
  expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
  expect(result.current.messages[1].content).toBe('hello');
});

test('clearMessages resets to welcome', () => {
  const { result } = renderHook(() => useChat(defaultOptions));

  act(() => {
    result.current.sendMessage('hello');
  });

  act(() => {
    result.current.clearMessages();
  });

  expect(result.current.messages).toHaveLength(1);
  expect(result.current.messages[0].id).toBe('welcome');
});
