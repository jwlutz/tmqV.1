import type { WidgetType } from './types'
import type { ChartLayout } from '../context'

export interface PanePreset {
  symbol?: string
  widgetType: WidgetType
}

export interface LayoutPreset {
  id: string
  label: string
  icon: string
  description: string
  layout: ChartLayout
  panes: PanePreset[]
}

export const LAYOUT_PRESETS: Record<string, LayoutPreset> = {
  trading: {
    id: 'trading',
    label: 'Trading',
    icon: '\u{1F4CA}',
    description: 'Multi-chart trading view',
    layout: '2x2',
    panes: [
      { symbol: 'BTC-USD', widgetType: 'candlestick' },
      { symbol: 'ETH-USD', widgetType: 'candlestick' },
      { symbol: 'SPY', widgetType: 'candlestick' },
      { symbol: 'QQQ', widgetType: 'candlestick' },
    ],
  },
  macro: {
    id: 'macro',
    label: 'Macro',
    icon: '\u{1F30D}',
    description: 'Macro regime and yields overview',
    layout: '2x2',
    panes: [
      { symbol: 'SPY', widgetType: 'candlestick' },
      { widgetType: 'yield_curve' },
      { widgetType: 'net_liquidity' },
      { widgetType: 'credit_spreads' },
    ],
  },
  research: {
    id: 'research',
    label: 'Research',
    icon: '\u{1F50D}',
    description: 'Fundamentals and correlation analysis',
    layout: '2x2',
    panes: [
      { symbol: 'AAPL', widgetType: 'candlestick' },
      { widgetType: 'fundamentals' },
      { widgetType: 'sector_heatmap' },
      { widgetType: 'correlation_matrix' },
    ],
  },
  sentiment: {
    id: 'sentiment',
    label: 'Sentiment',
    icon: '\u{1F4CA}',
    description: 'Market sentiment and volatility',
    layout: '2x2',
    panes: [
      { symbol: 'BTC-USD', widgetType: 'candlestick' },
      { widgetType: 'vix_term_structure' },
      { widgetType: 'sentiment_gauge' },
      { widgetType: 'economic_calendar' },
    ],
  },
}
