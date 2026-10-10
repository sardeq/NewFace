import { useEffect } from 'react'

/** Everything that should answer a press with an ink ripple. */
const RIPPLE_TARGETS = [
  '.btn',
  '.icon-btn',
  '.act',
  '.chip',
  '.rail-link',
  '.rail-report',
  '.tab',
  '.segmented button',
  '.amount-chip',
  '.method',
  '.share-tile',
  '.capture',
  '.composer',
  '.legend-item',
  '.maplist-row',
  '.docket-row',
  '.person',
  '.menu-item',
  '.notif',
  '.lang-toggle',
  '.sev-pick button',
  '.link-btn',
].join(',')

/**
 * One delegated pointerdown listener that drops an expanding ripple where you pressed.
 * The ripple lives in its own clipped layer so badges that overflow their button are not cut off.
 */
export function useRipples() {
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      const el = (e.target as Element | null)?.closest?.(RIPPLE_TARGETS) as HTMLElement | null
      if (!el || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative'

      let layer = el.querySelector<HTMLSpanElement>(':scope > .ripple-layer')
      if (!layer) {
        layer = document.createElement('span')
        layer.className = 'ripple-layer'
        layer.setAttribute('aria-hidden', 'true')
        el.appendChild(layer)
      }
      const r = el.getBoundingClientRect()
      const size = Math.hypot(r.width, r.height) * 2
      const dot = document.createElement('span')
      dot.className = 'ripple'
      dot.style.width = dot.style.height = `${size}px`
      dot.style.left = `${e.clientX - r.left - size / 2}px`
      dot.style.top = `${e.clientY - r.top - size / 2}px`
      layer.appendChild(dot)
      dot.addEventListener('animationend', () => dot.remove(), { once: true })
    }
    document.addEventListener('pointerdown', onDown, { passive: true })
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])
}
