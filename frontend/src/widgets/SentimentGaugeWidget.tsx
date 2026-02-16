import { useState, useEffect } from 'react'
import type { WidgetDefinition } from './types'

// --- SVG Gauge ---

function SemiCircleGauge({ score, width }: { score: number; width: number }) {
  const clampedScore = Math.max(0, Math.min(100, score))
  const radius = Math.min(width * 0.35, 120)
  const centerX = width / 2
  const centerY = radius + 10
  const strokeWidth = radius * 0.22
  const innerRadius = radius - strokeWidth / 2

  // Arc segments (5 zones)
  const segments = [
    { start: 0, end: 20, color: '#FF1744' },
    { start: 20, end: 40, color: '#FF6D00' },
    { start: 40, end: 60, color: '#FFD600' },
    { start: 60, end: 80, color: '#69F0AE' },
    { start: 80, end: 100, color: '#00C853' },
  ]

  function arcPath(startPct: number, endPct: number): string {
    // 0% = left (180°), 100% = right (0°)
    const startAngle = Math.PI - (startPct / 100) * Math.PI
    const endAngle = Math.PI - (endPct / 100) * Math.PI
    const x1 = centerX + innerRadius * Math.cos(startAngle)
    const y1 = centerY - innerRadius * Math.sin(startAngle)
    const x2 = centerX + innerRadius * Math.cos(endAngle)
    const y2 = centerY - innerRadius * Math.sin(endAngle)
    const largeArc = Math.abs(endPct - startPct) > 50 ? 1 : 0
    return `M ${x1} ${y1} A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${x2} ${y2}`
  }

  // Needle
  const needleAngle = Math.PI - (clampedScore / 100) * Math.PI
  const needleLength = innerRadius - strokeWidth * 0.3
  const needleX = centerX + needleLength * Math.cos(needleAngle)
  const needleY = centerY - needleLength * Math.sin(needleAngle)

  const label = clampedScore < 20 ? 'Extreme Fear'
    : clampedScore < 35 ? 'Fear'
    : clampedScore < 50 ? 'Neutral'
    : clampedScore < 65 ? 'Neutral / Greed'
    : clampedScore < 80 ? 'Greed'
    : 'Extreme Greed'

  const labelColor = clampedScore < 25 ? '#FF1744'
    : clampedScore < 50 ? '#FF9100'
    : clampedScore < 75 ? '#FFD600'
    : '#00C853'

  return (
    <svg width={width} height={centerY + 30} className="block mx-auto">
      {/* Arc segments */}
      {segments.map((seg, i) => (
        <path
          key={i}
          d={arcPath(seg.start, seg.end)}
          fill="none"
          stroke={seg.color}
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
          opacity={0.7}
        />
      ))}

      {/* Needle - with shadow for better visibility */}
      <line
        x1={centerX}
        y1={centerY}
        x2={needleX}
        y2={needleY}
        stroke="#0a0a14"
        strokeWidth={6}
        strokeLinecap="round"
      />
      <line
        x1={centerX}
        y1={centerY}
        x2={needleX}
        y2={needleY}
        stroke="white"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <circle cx={centerX} cy={centerY} r={7} fill="#0a0a14" />
      <circle cx={centerX} cy={centerY} r={5} fill="white" />

      {/* Score text */}
      <text
        x={centerX}
        y={centerY - radius * 0.15}
        textAnchor="middle"
        fill="white"
        fontSize={Math.max(24, radius * 0.4)}
        fontWeight="bold"
        fontFamily="monospace"
      >
        {Math.round(clampedScore)}
      </text>

      {/* Label */}
      <text
        x={centerX}
        y={centerY + 20}
        textAnchor="middle"
        fill={labelColor}
        fontSize={11}
        fontWeight="600"
      >
        {label}
      </text>

      {/* FEAR / GREED labels */}
      <text
        x={centerX - innerRadius - 5}
        y={centerY + 4}
        textAnchor="end"
        fill="#FF1744"
        fontSize={9}
        fontWeight="600"
        opacity={0.7}
      >
        FEAR
      </text>
      <text
        x={centerX + innerRadius + 5}
        y={centerY + 4}
        textAnchor="start"
        fill="#00C853"
        fontSize={9}
        fontWeight="600"
        opacity={0.7}
      >
        GREED
      </text>
    </svg>
  )
}

// --- Main Widget ---

interface SentimentGaugeWidgetProps {
  definition: WidgetDefinition
  width: number
  height: number
}

export function SentimentGaugeWidget({ }: SentimentGaugeWidgetProps) {
  const [containerWidth, setContainerWidth] = useState(300)
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null)

  // Static demo score (neutral)
  const demoScore = 50

  // Responsive width via ResizeObserver
  useEffect(() => {
    if (!containerRef) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w) setContainerWidth(w)
    })
    ro.observe(containerRef)
    return () => ro.disconnect()
  }, [containerRef])

  return (
    <div ref={setContainerRef} className="w-full h-full flex flex-col bg-[var(--bg-dark)] overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--border)]">
        <span className="text-xs font-semibold text-[var(--text-primary)] tracking-wide uppercase">
          Fear & Greed Index
        </span>
      </div>

      {/* Gauge */}
      <div className="flex-shrink-0 flex items-center justify-center py-4">
        <SemiCircleGauge score={demoScore} width={Math.min(containerWidth - 24, 340)} />
      </div>

      {/* Coming Soon */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="text-[var(--text-secondary)] text-sm font-medium mb-2">
          Coming Soon
        </div>
        <div className="text-[var(--text-tertiary)] text-xs leading-relaxed">
          Full CNN-style Fear & Greed Index with all 7 indicators: market momentum, stock price strength, breadth, put/call ratio, junk bond demand, VIX, and safe haven demand.
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-1 border-t border-[var(--border)] text-[9px] text-[var(--text-tertiary)]">
        Requires NYSE advance/decline data & CBOE put/call ratio
      </div>
    </div>
  )
}
