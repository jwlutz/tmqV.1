import { render, screen, fireEvent } from '@testing-library/react';
import { AppProvider, useMode } from '../AppContext';

function TestComponent() {
  const { mode, setMode } = useMode();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <button onClick={() => setMode('backtest')}>Switch</button>
    </div>
  );
}

test('mode starts as live', () => {
  render(
    <AppProvider>
      <TestComponent />
    </AppProvider>
  );

  expect(screen.getByTestId('mode')).toHaveTextContent('live');
});

test('setMode changes mode', () => {
  render(
    <AppProvider>
      <TestComponent />
    </AppProvider>
  );

  fireEvent.click(screen.getByText('Switch'));
  expect(screen.getByTestId('mode')).toHaveTextContent('backtest');
});

test('useMode throws outside provider', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

  expect(() => render(<TestComponent />)).toThrow(
    'useAppContext must be used within AppProvider'
  );

  spy.mockRestore();
});
