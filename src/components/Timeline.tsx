import { Icon } from './Icon'
import { fmtDateTime, LIFECYCLE, STATUS_META } from '../lib/format'
import type { IssueStatus, StatusEvent } from '../types'

/** Horizontal lifecycle rail: where the issue is in its life. */
export function LifecycleRail({ status }: { status: IssueStatus }) {
  if (status === 'rejected')
    return (
      <div className="rail-closed mono caps">
        <Icon name="x" size={14} /> Closed — not actionable
      </div>
    )
  const at = STATUS_META[status].step
  return (
    <ol className="lifecycle" aria-label="Lifecycle">
      {LIFECYCLE.map((s, i) => (
        <li key={s} className={i < at ? 'done' : i === at ? 'now' : ''}>
          <span className="lc-dot">{i < at ? <Icon name="check" size={11} stroke={3} /> : i + 1}</span>
          <span className="lc-label">{STATUS_META[s].short}</span>
        </li>
      ))}
    </ol>
  )
}

/** Vertical log of every status change with notes. */
export function EventLog({ events }: { events: StatusEvent[] }) {
  return (
    <ol className="eventlog">
      {[...events].reverse().map((e) => (
        <li key={e.id} className={`tone-${STATUS_META[e.status].tone}`}>
          <span className="ev-pin" />
          <div>
            <div className="ev-head">
              <strong>{STATUS_META[e.status].label}</strong>
              <time className="mono muted">{fmtDateTime(e.at)}</time>
            </div>
            {e.note && <p>{e.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}
