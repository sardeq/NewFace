import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { IssueMap } from '../components/Maps'
import { Icon } from '../components/Icon'
import { FundingTape, Photo, Stamp } from '../components/ui'
import { useIssues } from '../data/hooks'
import { CATEGORY_META, STATUS_META, ticketRef, timeAgo } from '../lib/format'
import type { IssueStatus } from '../types'

const LEGEND: IssueStatus[] = ['pending_review', 'open_for_funding', 'assigned', 'in_progress', 'resolved']

export default function MapPage() {
  const { data = [] } = useIssues({ sort: 'hot', status: 'all' })
  const [hidden, setHidden] = useState<Set<IssueStatus>>(new Set())
  const [active, setActive] = useState<string | undefined>()
  const shown = useMemo(() => data.filter((i) => !hidden.has(i.status)), [data, hidden])
  const sel = shown.find((i) => i.id === active)

  const toggle = (s: IssueStatus) =>
    setHidden((h) => {
      const n = new Set(h)
      if (n.has(s)) n.delete(s)
      else n.add(s)
      return n
    })

  return (
    <div className="mappage">
      <div className="mappage-map">
        <IssueMap issues={shown} activeId={active} onSelect={setActive} />
        <div className="map-legend">
          <div className="mono caps">Survey map · {shown.length} pins</div>
          {LEGEND.map((s) => (
            <button key={s} className={`legend-item tone-${STATUS_META[s].tone} ${hidden.has(s) ? 'off' : ''}`} onClick={() => toggle(s)}>
              <i />
              {STATUS_META[s].label}
            </button>
          ))}
        </div>
        {sel && (
          <div className="map-card">
            <button className="icon-btn map-card-x" onClick={() => setActive(undefined)} aria-label="Close">
              <Icon name="x" size={16} />
            </button>
            <Photo src={sel.photos[0]} alt={sel.title} className="map-card-img" />
            <div className="map-card-body">
              <div className="ticket-meta mono">
                <span className="ticket-ref">{ticketRef(sel.ref)}</span>
                <span className="sep">/</span>
                <span>{CATEGORY_META[sel.category].code}</span>
                <span className="ticket-time">{timeAgo(sel.createdAt)}</span>
              </div>
              <h3>{sel.title}</h3>
              <Stamp status={sel.status} small />
              {sel.estimatedCost !== null && <FundingTape raised={sel.raised} goal={sel.estimatedCost} compact />}
              <Link to={`/issue/${sel.id}`} className="btn btn-ink btn-sm">
                <span>Open report</span>
                <Icon name="arrowRight" size={15} />
              </Link>
            </div>
          </div>
        )}
      </div>
      <aside className="mappage-list">
        <div className="mono caps muted pad">Sorted by urgency</div>
        <ul>
          {shown.map((i) => (
            <li key={i.id}>
              <button className={`maplist-row ${i.id === active ? 'on' : ''}`} onClick={() => setActive(i.id)}>
                <span className={`dot tone-${STATUS_META[i.status].tone}`} />
                <span className="maplist-text">
                  <strong>{i.title}</strong>
                  <span className="mono muted">
                    {ticketRef(i.ref)} · {i.district}
                  </span>
                </span>
                <span className="num mono">{i.upvotes - i.downvotes}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
