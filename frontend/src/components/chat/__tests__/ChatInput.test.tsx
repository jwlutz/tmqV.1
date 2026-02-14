import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInput } from '../ChatInput';

test('calls onSend when pressing Enter', () => {
  const onSend = vi.fn();
  render(<ChatInput onSend={onSend} />);

  const input = screen.getByPlaceholderText(/ask about/i);
  fireEvent.change(input, { target: { value: 'hello' } });
  fireEvent.keyDown(input, { key: 'Enter' });

  expect(onSend).toHaveBeenCalledWith('hello');
});

test('does not send empty messages', () => {
  const onSend = vi.fn();
  render(<ChatInput onSend={onSend} />);

  const input = screen.getByPlaceholderText(/ask about/i);
  fireEvent.keyDown(input, { key: 'Enter' });

  expect(onSend).not.toHaveBeenCalled();
});

test('clears input after sending', () => {
  const onSend = vi.fn();
  render(<ChatInput onSend={onSend} />);

  const input = screen.getByPlaceholderText(/ask about/i) as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: 'test message' } });
  fireEvent.keyDown(input, { key: 'Enter' });

  expect(input.value).toBe('');
});

test('does not send on Shift+Enter', () => {
  const onSend = vi.fn();
  render(<ChatInput onSend={onSend} />);

  const input = screen.getByPlaceholderText(/ask about/i);
  fireEvent.change(input, { target: { value: 'hello' } });
  fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

  expect(onSend).not.toHaveBeenCalled();
});

test('send button is disabled when input is empty', () => {
  const onSend = vi.fn();
  render(<ChatInput onSend={onSend} />);

  const button = screen.getByRole('button');
  expect(button).toBeDisabled();
});

test('send button is disabled when disabled prop is true', () => {
  const onSend = vi.fn();
  render(<ChatInput onSend={onSend} disabled />);

  const input = screen.getByPlaceholderText(/ask about/i);
  fireEvent.change(input, { target: { value: 'hello' } });

  const button = screen.getByRole('button');
  expect(button).toBeDisabled();
});
