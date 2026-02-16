export type WidgetType =
  | 'candlestick'
  | 'net_liquidity'
  | 'credit_spreads'
  | 'yield_curve'
  | 'vix_term_structure'
  | 'fundamentals'
  | 'macro_regime'
  | 'sector_heatmap'
  | 'correlation_matrix'
  | 'economic_calendar'
  | 'sentiment_gauge'

export interface WidgetDefinition {
  type: WidgetType
  label: string
  icon: string
  category: 'Charts' | 'Macro' | 'Fundamentals' | 'Sentiment'
  description: string
  needsSymbol: boolean
  needsInterval: boolean
  supportsIndicators: boolean
  supportsMacroOverlay: boolean
}

export const WIDGET_REGISTRY: Record<WidgetType, WidgetDefinition> = {
  candlestick: {
    type: 'candlestick',
    label: 'Candlestick',
    icon: '\u{1F4CA}',
    category: 'Charts',
    description: 'OHLCV candlestick chart with indicators and overlays',
    needsSymbol: true,
    needsInterval: true,
    supportsIndicators: true,
    supportsMacroOverlay: true,
  },
  net_liquidity: {
    type: 'net_liquidity',
    label: 'Net Liquidity',
    icon: '\u{1F4B0}',
    category: 'Macro',
    description: 'Fed balance sheet minus TGA and reverse repo',
    needsSymbol: false,
    needsInterval: false,
    supportsIndicators: false,
    supportsMacroOverlay: false,
  },
  credit_spreads: {
    type: 'credit_spreads',
    label: 'Credit Spreads',
    icon: '\u{1F4C9}',
    category: 'Macro',
    description: 'Investment-grade and high-yield credit spreads',
    needsSymbol: false,
    needsInterval: false,
    supportsIndicators: false,
    supportsMacroOverlay: false,
  },
  yield_curve: {
    type: 'yield_curve',
    label: 'Yield Curve',
    icon: '\u{1F4C8}',
    category: 'Macro',
    description: 'US Treasury yield curve across maturities',
    needsSymbol: false,
    needsInterval: false,
    supportsIndicators: false,
    supportsMacroOverlay: false,
  },
  vix_term_structure: {
    type: 'vix_term_structure',
    label: 'VIX Term Structure',
    icon: '\u{26A1}',
    category: 'Macro',
    description: 'VIX futures term structure contango/backwardation',
    needsSymbol: false,
    needsInterval: false,
    supportsIndicators: false,
    supportsMacroOverlay: false,
  },
  fundamentals: {
    type: 'fundamentals',
    label: 'Fundamentals',
    icon: '\u{1F4CB}',
    category: 'Fundamentals',
    description: 'Key financial metrics and valuation ratios',
    needsSymbol: true,
    needsInterval: false,
    supportsIndicators: false,
    supportsMacroOverlay: false,
  },
  macro_regime: {
    type: 'macro_regime',
    label: 'Macro Regime',
    icon: '\u{1F30D}',
    category: 'Macro',
    description: 'Current macro regime based on growth and inflation',
    needsSymbol: false,
    needsInterval: false,
    supportsIndicators: false,
    supportsMacroOverlay: false,
  },
  sector_heatmap: {
    type: 'sector_heatmap',
    label: 'Sector Heatmap',
    icon: '\u{1F3AF}',
    category: 'Fundamentals',
    description: 'S&P 500 sector performance heatmap',
    needsSymbol: false,
    needsInterval: false,
    supportsIndicators: false,
    supportsMacroOverlay: false,
  },
  correlation_matrix: {
    type: 'correlation_matrix',
    label: 'Correlation Matrix',
    icon: '\u{1F522}',
    category: 'Charts',
    description: 'Cross-asset correlation matrix',
    needsSymbol: false,
    needsInterval: false,
    supportsIndicators: false,
    supportsMacroOverlay: false,
  },
  economic_calendar: {
    type: 'economic_calendar',
    label: 'Econ Calendar',
    icon: '\u{1F4C5}',
    category: 'Macro',
    description: 'Upcoming economic data releases and events',
    needsSymbol: false,
    needsInterval: false,
    supportsIndicators: false,
    supportsMacroOverlay: false,
  },
  sentiment_gauge: {
    type: 'sentiment_gauge',
    label: 'Sentiment',
    icon: '\u{1F4CA}',
    category: 'Sentiment',
    description: 'Market sentiment indicators and fear/greed index',
    needsSymbol: false,
    needsInterval: false,
    supportsIndicators: false,
    supportsMacroOverlay: false,
  },
}
