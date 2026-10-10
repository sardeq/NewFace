import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from './Icon'
import { fmtMoney, pct, STATUS_META } from '../lib/format'
import type { IssueStatus, Profile } from '../types'

/* ───────── Photo: an uploaded image, or a plain tile if it's missing ───────── */
export function Photo({ src, alt, className = '' }: { src?: string; alt: string; className?: string }) {
  if (!src || !/^(https?:|data:image\/|blob:)/.test(src))
    return (
      <span className={`photo-missing ${className}`} role="img" aria-label={alt || 'No photo'}>
        <Icon name="camera" size={22} />
      </span>
    )
  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" />
}

/* ───────── Avatar: monogram on a tinted disc ───────── */
export function Avatar({ profile, size = 32 }: { profile?: Profile | null; size?: number }) {
  const name = profile?.company ?? profile?.name ?? '?'
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  const hue = profile?.hue ?? 30
  return (
    <span
      className={`avatar ${profile?.role === 'admin' ? 'is-admin' : ''} ${profile?.role === 'contractor' ? 'is-contractor' : ''}`}
      style={{ width: size, height: size, fontSize: size * 0.38, ['--hue' as string]: hue }}
      title={profile?.name}
    >
      {initials}
    </span>
  )
}

/* ───────── Rubber-stamp status ───────── */
export function Stamp({ status, small }: { status: IssueStatus; small?: boolean }) {
  const m = STATUS_META[status]
  return <span className={`stamp tone-${m.tone} ${small ? 'stamp-sm' : ''}`}>{small ? m.short : m.label}</span>
}

/* ───────── Funding tape: a tape-measure that fills ───────── */
export function FundingTape({ raised, goal, donors, compact }: { raised: number; goal: number | null; donors?: number; compact?: boolean }) {
  const p = pct(raised, goal)
  const done = goal !== null && raised >= goal
  return (
    <div className={`tape ${done ? 'is-done' : ''} ${compact ? 'is-compact' : ''}`}>
      <div className="tape-head">
        <span className="tape-raised num">{fmtMoney(raised)}</span>
        <span className="tape-goal mono">
          {goal ? <>of {fmtMoney(goal)}</> : 'awaiting estimate'}
        </span>
        <span className="tape-pct mono num">{done ? 'FUNDED' : `${p}%`}</span>
      </div>
      <div className="tape-track" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label="Funding progress">
        <div className="tape-fill" style={{ width: `${p}%` }} />
        <div className="tape-ticks" />
      </div>
      {!compact && donors !== undefined && (
        <div className="tape-foot mono">
          {donors} {donors === 1 ? 'neighbour' : 'neighbours'} chipped in
          {goal && !done ? <> · {fmtMoney(Math.max(0, goal - raised))} to go</> : null}
        </div>
      )}
    </div>
  )
}

/* ───────── Urgency meter (severity 1–5) ───────── */
export function Urgency({ level, label = true }: { level: number; label?: boolean }) {
  return (
    <span className="urgency" title={`Urgency ${level} of 5`}>
      <span className="urgency-bars" aria-hidden>
        {[1, 2, 3, 4, 5].map((n) => (
          <i key={n} className={n <= level ? 'on' : ''} style={{ height: 4 + n * 2.2 }} />
        ))}
      </span>
      {label && <span className="mono caps">Urgency {level}/5</span>}
    </span>
  )
}

/* ───────── Button ───────── */
type BtnVariant = 'primary' | 'ink' | 'line' | 'ghost' | 'danger' | 'moss'
export function Button({
  variant = 'line',
  icon,
  iconRight,
  children,
  loading,
  size,
  className = '',
  ...rest
}: {
  variant?: BtnVariant
  icon?: IconName
  iconRight?: IconName
  loading?: boolean
  size?: 'sm' | 'lg'
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${loading ? 'is-loading' : ''} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 15 : 17} />}
    </button>
  )
}

/* ───────── Sheet / modal ───────── */
export function Sheet({
  open,
  onClose,
  title,
  kicker,
  children,
  width = 520,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  kicker?: ReactNode
  children: ReactNode
  width?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" style={{ maxWidth: width }} tabIndex={-1} ref={ref}>
        <header className="sheet-head">
          <div>
            {kicker && <div className="mono caps muted">{kicker}</div>}
            <h2>{title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </header>
        <div className="stitch-rule" />
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

/* ───────── Toasts ───────── */
type Toast = { id: number; text: string; tone: 'ok' | 'err' }
let push: ((t: Omit<Toast, 'id'>) => void) | null = null
// eslint-disable-next-line react-refresh/only-export-components
export const toast = (text: string, tone: Toast['tone'] = 'ok') => push?.({ text, tone })

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([])
  useEffect(() => {
    push = (t) => {
      const id = Date.now() + Math.random()
      setItems((xs) => [...xs, { ...t, id }])
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3800)
    }
    return () => {
      push = null
    }
  }, [])
  return (
    <div className="toaster" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          <Icon name={t.tone === 'ok' ? 'check' : 'alert'} size={16} />
          {t.text}
        </div>
      ))}
    </div>
  )
}

/* ───────── Small bits ───────── */
export function Empty({ icon = 'stitch', title, children }: { icon?: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={28} />
      <h3>{title}</h3>
      {children && <p className="muted">{children}</p>}
    </div>
  )
}

export function Skeleton({ h = 120 }: { h?: number }) {
  return <div className="skeleton" style={{ height: h }} />
}

export function Field({
  label,
  hint,
  error,
  errorId,
  children,
}: {
  label: string
  hint?: ReactNode
  /** Validation message shown under the control (replaces the hint while present). */
  error?: string
  /** Give the input `aria-describedby={errorId}` so screen readers announce the error. */
  errorId?: string
  children: ReactNode
}) {
  return (
    <label className={`field ${error ? 'has-error' : ''}`}>
      <span className="field-label mono caps">{label}</span>
      {children}
      {error ? (
        <span className="field-error" id={errorId} role="alert">
          {error}
        </span>
      ) : (
        hint && <span className="field-hint">{hint}</span>
      )}
    </label>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: Array<{ value: T; label: string; icon?: IconName; count?: number }>
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <Icon name={o.icon} size={15} />}
          {o.label}
          {o.count !== undefined && <span className="seg-count num">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}
