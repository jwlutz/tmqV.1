export { WIDGET_REGISTRY } from './types'
export type { WidgetType, WidgetDefinition } from './types'
export { PlaceholderWidget } from './PlaceholderWidget'
export { CandlestickWidget } from './CandlestickWidget'
export { LAYOUT_PRESETS } from './presets'
export type { LayoutPreset, PanePreset } from './presets'

import { lazy, type ComponentType } from 'react'
import type { WidgetType } from './types'
import { CandlestickWidget } from './CandlestickWidget'
import { PlaceholderWidget } from './PlaceholderWidget'

// Lazy-load non-candlestick widgets — they're only needed when selected
const NetLiquidityWidget = lazy(() => import('./NetLiquidityWidget').then(m => ({ default: m.NetLiquidityWidget })))
const CreditSpreadsWidget = lazy(() => import('./CreditSpreadsWidget').then(m => ({ default: m.CreditSpreadsWidget })))
const MacroRegimeWidget = lazy(() => import('./MacroRegimeWidget').then(m => ({ default: m.MacroRegimeWidget })))
const SectorHeatmapWidget = lazy(() => import('./SectorHeatmapWidget').then(m => ({ default: m.SectorHeatmapWidget })))
const CorrelationMatrixWidget = lazy(() => import('./CorrelationMatrixWidget').then(m => ({ default: m.CorrelationMatrixWidget })))
const EconomicCalendarWidget = lazy(() => import('./EconomicCalendarWidget').then(m => ({ default: m.EconomicCalendarWidget })))
const SentimentGaugeWidget = lazy(() => import('./SentimentGaugeWidget').then(m => ({ default: m.SentimentGaugeWidget })))
const YieldCurveWidget = lazy(() => import('./YieldCurveWidget').then(m => ({ default: m.YieldCurveWidget })))
const VIXTermStructureWidget = lazy(() => import('./VIXTermStructureWidget').then(m => ({ default: m.VIXTermStructureWidget })))

export function getWidgetComponent(type: WidgetType): ComponentType<any> {
  switch (type) {
    case 'candlestick': return CandlestickWidget
    case 'net_liquidity': return NetLiquidityWidget
    case 'credit_spreads': return CreditSpreadsWidget
    case 'macro_regime': return MacroRegimeWidget
    case 'sector_heatmap': return SectorHeatmapWidget
    case 'correlation_matrix': return CorrelationMatrixWidget
    case 'economic_calendar': return EconomicCalendarWidget
    case 'sentiment_gauge': return SentimentGaugeWidget
    case 'yield_curve': return YieldCurveWidget
    case 'vix_term_structure': return VIXTermStructureWidget
    default: return PlaceholderWidget
  }
}
