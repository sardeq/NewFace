import { useRef, useState } from 'react'
import { Photo } from './ui'

/** Drag the seam to compare before / after. Keyboard: ← → */
export function BeforeAfter({ before, after, label }: { before: string; after: string; label: string }) {
  const [pos, setPos] = useState(50)
  const ref = useRef<HTMLDivElement>(null)
  const move = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)))
  }
  return (
    <div
      ref={ref}
      className="ba"
      style={{ ['--pos' as string]: `${pos}%` }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        move(e.clientX)
      }}
      onPointerMove={(e) => e.buttons === 1 && move(e.clientX)}
    >
      <Photo src={after} alt={`${label} — after`} className="ba-img" />
      <div className="ba-before">
        <Photo src={before} alt={`${label} — before`} className="ba-img" />
      </div>
      <span className="ba-tag ba-tag-l mono caps">Before</span>
      <span className="ba-tag ba-tag-r mono caps">After</span>
      <div
        className="ba-seam"
        role="slider"
        tabIndex={0}
        aria-label="Compare before and after"
        aria-valuenow={Math.round(pos)}
        aria-valuemin={0}
        aria-valuemax={100}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 5))
          if (e.key === 'ArrowRight') setPos((p) => Math.min(100, p + 5))
        }}
      >
        <span className="ba-knob" />
      </div>
    </div>
  )
}
