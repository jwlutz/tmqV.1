import { useState } from 'react'

const VIDEOS = {
  subway_surfers: {
    label: 'Subway Surfers',
    id: 'vTfD20dbxho',
  },
  family_guy: {
    label: 'Family Guy',
    id: 'aVab1ERvdEM',
  },
  brainrot: {
    label: 'Brainrot',
    id: '3xWJ0FSgJVE',
  },
  south_park: {
    label: 'South Park',
    id: 'TdQVPLZ-O2A',
  },
} as const

type VideoKey = keyof typeof VIDEOS

export function RotContent() {
  const [selected, setSelected] = useState<VideoKey>('subway_surfers')

  const embedUrl = `https://www.youtube.com/embed/${VIDEOS[selected].id}?autoplay=1`

  return (
    <div className="w-full h-full flex flex-col bg-[var(--bg-dark)] overflow-hidden">
      {/* Header with selector */}
      <div className="px-3 py-2 border-b border-[var(--border)] flex items-center gap-3">
        <span className="text-xs font-semibold text-[var(--text-primary)] tracking-wide uppercase">
          Rot
        </span>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value as VideoKey)}
          className="flex-1 px-2 py-1 text-xs bg-[var(--bg-darker)] text-[var(--text-primary)] border border-[var(--border)] rounded cursor-pointer hover:border-[var(--text-tertiary)] transition-colors"
        >
          {(Object.keys(VIDEOS) as VideoKey[]).map((key) => (
            <option key={key} value={key}>
              {VIDEOS[key].label}
            </option>
          ))}
        </select>
      </div>

      {/* YouTube embed */}
      <div className="flex-1 relative">
        <iframe
          key={selected}
          src={embedUrl}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  )
}
