import { Icon } from './Icon'
import { fmtDateTime, LIFECYCLE, statusLabel, statusShort, STATUS_META } from '../lib/format'
import { t, useT } from '../i18n'
import type { IssueStatus, StatusEvent } from '../types'

/** Horizontal lifecycle rail: where the issue is in its life. */
export function LifecycleRail({ status }: { status: IssueStatus }) {
  useT()
  if (status === 'rejected')
    return (
      <div className="rail-closed mono caps">
        <Icon name="x" size={14} /> {t('Closed — not actionable')}
      </div>
    )
  const at = STATUS_META[status].step
  return (
    <ol className="lifecycle" aria-label={t('Lifecycle')}>
      {LIFECYCLE.map((s, i) => (
        <li key={s} className={i < at ? 'done' : i === at ? 'now' : ''} style={{ ['--i' as string]: i }}>
          <span className="lc-dot">{i < at ? <Icon name="check" size={11} stroke={3} /> : i + 1}</span>
          <span className="lc-label">{statusShort(s)}</span>
        </li>
      ))}
    </ol>
  )
}

/** Vertical log of every status change with notes. */
export function EventLog({ events }: { events: StatusEvent[] }) {
  useT()
  return (
    <ol className="eventlog">
      {[...events].reverse().map((e) => (
        <li key={e.id} className={`tone-${STATUS_META[e.status].tone}`}>
          <span className="ev-pin" />
          <div>
            <div className="ev-head">
              <strong>{statusLabel(e.status)}</strong>
              <time className="mono muted">{fmtDateTime(e.at)}</time>
            </div>
            {e.note && <p>{e.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}
