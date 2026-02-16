import { useCallback, useRef, useState, type RefObject } from 'react'

interface ResizeHandleProps {
  direction: 'vertical' | 'horizontal'
  ratio: number
  onRatioChange: (ratio: number) => void
  onReset: () => void
  containerRef: RefObject<HTMLElement | null>
  className?: string
}

export function ResizeHandle({ direction, ratio, onRatioChange, onReset, containerRef, className }: ResizeHandleProps) {
  const draggingRef = useRef(false)
  const rafId = useRef(0)
  const [hovered, setHovered] = useState(false)
  const [active, setActive] = useState(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    draggingRef.current = true
    setActive(true)
    document.body.style.cursor = direction === 'vertical' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'

    const onMouseMove = (ev: MouseEvent) => {
      if (!draggingRef.current || !containerRef.current) return
      cancelAnimationFrame(rafId.current)
      rafId.current = requestAnimationFrame(() => {
        const rect = containerRef.current!.getBoundingClientRect()
        let newRatio: number
        if (direction === 'vertical') {
          newRatio = (ev.clientX - rect.left) / rect.width
        } else {
          newRatio = (ev.clientY - rect.top) / rect.height
        }
        onRatioChange(Math.min(0.85, Math.max(0.15, newRatio)))
      })
    }

    const onMouseUp = () => {
      draggingRef.current = false
      setActive(false)
      cancelAnimationFrame(rafId.current)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [direction, onRatioChange, containerRef])

  const isVertical = direction === 'vertical'
  const visible = hovered || active

  const style: React.CSSProperties = isVertical
    ? { left: `${ratio * 100}%`, top: 0, bottom: 0, width: 12, transform: 'translateX(-50%)' }
    : { top: `${ratio * 100}%`, left: 0, right: 0, height: 12, transform: 'translateY(-50%)' }

  const lineStyle: React.CSSProperties = isVertical
    ? { position: 'absolute', width: 3, top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', borderRadius: 2 }
    : { position: 'absolute', height: 3, left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', borderRadius: 2 }

  return (
    <div
      className={className ?? "absolute z-10"}
      style={{ ...style, cursor: isVertical ? 'col-resize' : 'row-resize' }}
      onMouseDown={handleMouseDown}
      onDoubleClick={onReset}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          ...lineStyle,
          backgroundColor: 'var(--green-up)',
          opacity: visible ? 0.4 : 0,
          transition: 'opacity 150ms',
        }}
      />
    </div>
  )
}
