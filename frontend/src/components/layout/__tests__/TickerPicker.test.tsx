import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TickerPicker } from '../TickerPicker'
import { AppProvider } from '../../../context'

const MOCK_SYMBOLS = ['BTC/USD', 'ETH/USD', 'SOL/USD', 'DOGE/USD']

beforeEach(() => {
  vi.restoreAllMocks()
  globalThis.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve(MOCK_SYMBOLS),
  }) as unknown as typeof fetch
})

function renderPicker() {
  return render(
    <AppProvider>
      <TickerPicker />
    </AppProvider>
  )
}

describe('TickerPicker', () => {
  it('renders with default symbol', () => {
    renderPicker()
    expect(screen.getByText('BTC/USD')).toBeInTheDocument()
  })

  it('opens dropdown on click', async () => {
    renderPicker()
    fireEvent.click(screen.getByText('BTC/USD'))
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search symbols...')).toBeInTheDocument()
    })
  })

  it('fetches and displays symbols', async () => {
    renderPicker()
    fireEvent.click(screen.getByText('BTC/USD'))
    await waitFor(() => {
      expect(screen.getByText('ETH/USD')).toBeInTheDocument()
      expect(screen.getByText('SOL/USD')).toBeInTheDocument()
    })
  })

  it('filters symbols on search', async () => {
    renderPicker()
    fireEvent.click(screen.getByText('BTC/USD'))

    await waitFor(() => {
      expect(screen.getByText('ETH/USD')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText('Search symbols...'), {
      target: { value: 'ETH' },
    })

    expect(screen.getByText('ETH/USD')).toBeInTheDocument()
    expect(screen.queryByText('SOL/USD')).not.toBeInTheDocument()
  })

  it('selects a symbol and closes dropdown', async () => {
    renderPicker()
    fireEvent.click(screen.getByText('BTC/USD'))

    await waitFor(() => {
      expect(screen.getByText('ETH/USD')).toBeInTheDocument()
    })

    // Click ETH/USD in the dropdown list (it's the button inside the <li>)
    const ethButtons = screen.getAllByText('ETH/USD')
    // The dropdown item is the last one (the button shows the current symbol too initially)
    fireEvent.click(ethButtons[ethButtons.length - 1])

    // Dropdown should close, button should show new symbol
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Search symbols...')).not.toBeInTheDocument()
    })
    expect(screen.getByText('ETH/USD')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch
    renderPicker()
    fireEvent.click(screen.getByText('BTC/USD'))
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
})
