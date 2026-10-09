import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { IssueCard } from '../components/IssueCard'
import { useActions } from '../components/Actions'
import { Icon } from '../components/Icon'
import { Avatar, Empty, FundingTape, Photo, Segmented, Skeleton, toast } from '../components/ui'
import { useIssues, useStats, useStories } from '../data/hooks'
import { useSession } from '../session/SessionContext'
import { APP } from '../config'
import { getPosition } from '../lib/geo'
import { CATEGORIES, CATEGORY_META, fmtMoney, STATUS_META, ticketRef } from '../lib/format'
import type { Category, FeedQuery, FeedSort, GeoPoint } from '../types'

const SORTS: Array<{ value: FeedSort; label: string }> = [
  { value: 'hot', label: 'Urgent' },
  { value: 'new', label: 'Newest' },
  { value: 'top', label: 'Most backed' },
  { value: 'near', label: 'Near me' },
  { value: 'funding', label: 'Almost funded' },
]

const STATUS_FILTERS: Array<{ value: FeedQuery['status']; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'pending_review', label: STATUS_META.pending_review.short },
  { value: 'open_for_funding', label: STATUS_META.open_for_funding.short },
  { value: 'in_progress', label: STATUS_META.in_progress.short },
  { value: 'resolved', label: STATUS_META.resolved.short },
  { value: 'all', label: 'All' },
]

export default function Feed() {
  const [sort, setSort] = useState<FeedSort>('hot')
  const [status, setStatus] = useState<FeedQuery['status']>('active')
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [near, setNear] = useState<GeoPoint | null>(null)
  const q = useMemo<FeedQuery>(() => ({ sort, status, category, near }), [sort, status, category, near])
  const { data, isLoading } = useIssues(q)
  const actions = useActions()

  const pickSort = async (s: FeedSort) => {
    setSort(s)
    if (s === 'near' && !near) {
      try {
        setNear(await getPosition())
      } catch (e) {
        toast(`${(e as Error).message} Using the city centre.`, 'err')
        setNear(APP.defaultCenter)
      }
    }
  }

  return (
    <div className="page-grid">
      <section className="col-main">
        <header className="page-head">
          <div className="kicker mono caps">Public ledger · {APP.city}</div>
          <h1>
            What’s broken, <em>and who’s mending it.</em>
          </h1>
        </header>

        <Composer />

        <div className="feed-controls">
          <Segmented label="Sort feed" value={sort} options={SORTS} onChange={pickSort} />
          <div className="filter-row">
            <div className="chip-row" role="group" aria-label="Status">
              {STATUS_FILTERS.map((f) => (
                <button key={f.value} className={`chip ${status === f.value ? 'on' : ''}`} onClick={() => setStatus(f.value)}>
                  {f.label}
                </button>
              ))}
            </div>
            <label className="select-wrap">
              <Icon name="filter" size={14} />
              <select value={category} onChange={(e) => setCategory(e.target.value as Category | 'all')} aria-label="Category">
                <option value="all">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_META[c].label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="feed">
          {isLoading && [0, 1, 2].map((n) => <Skeleton key={n} h={420} />)}
          {!isLoading && data?.length === 0 && (
            <Empty title="Nothing on this page of the ledger">Try a different filter — or be the first to report something.</Empty>
          )}
          {data?.map((i) => (
            <IssueCard key={i.id} issue={i} near={sort === 'near' ? near : null} onShare={actions.share} onDonate={actions.donate} />
          ))}
        </div>
      </section>

      <aside className="col-aside">
        <CityPulse />
        <AlmostThere />
        <RecentlyMended />
      </aside>
    </div>
  )
}

function Composer() {
  const { user } = useSession()
  return (
    <Link to="/report" className="composer">
      <Avatar profile={user} size={36} />
      <span className="composer-prompt">Something broken on your street?</span>
      <span className="composer-tools">
        <span className="composer-tool">
          <Icon name="camera" size={18} /> Photo
        </span>
        <span className="composer-tool">
          <Icon name="locate" size={18} /> GPS
        </span>
      </span>
    </Link>
  )
}

function CityPulse() {
  const { data: s } = useStats()
  const rows: Array<[string, string, string?]> = s
    ? [
        ['Reports filed', String(s.reported)],
        ['Mended', String(s.resolved), 'moss'],
        ['Raised by neighbours', fmtMoney(s.raised), 'signal'],
        ['Open for funding', String(s.openForFunding)],
        ['Avg. days to fix', `${s.avgDaysToFix}`],
      ]
    : []
  return (
    <section className="ledger-card">
      <header>
        <span className="mono caps">City pulse</span>
        <span className="mono muted">live</span>
      </header>
      <dl className="ledger-rows">
        {rows.map(([k, v, tone]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd className={`num ${tone ? `t-${tone}` : ''}`}>{v}</dd>
          </div>
        ))}
        {!s && <Skeleton h={150} />}
      </dl>
    </section>
  )
}

function AlmostThere() {
  const { data = [] } = useIssues({ sort: 'funding', status: 'open_for_funding' })
  const actions = useActions()
  if (!data.length) return null
  return (
    <section className="ledger-card">
      <header>
        <span className="mono caps">Almost there</span>
        <Icon name="coin" size={16} />
      </header>
      <ul className="mini-list">
        {data.slice(0, 3).map((i) => (
          <li key={i.id}>
            <Link to={`/issue/${i.id}`} className="mini-title">
              <span className="mono muted">{ticketRef(i.ref)}</span> {i.title}
            </Link>
            <FundingTape raised={i.raised} goal={i.estimatedCost} compact />
            <button className="link-btn" onClick={() => actions.donate(i)}>
              Chip in →
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function RecentlyMended() {
  const { data = [] } = useStories()
  const { data: issues = [] } = useIssues({ sort: 'new', status: 'resolved' })
  if (!data.length) return null
  const s = data[0]
  const issue = issues.find((i) => i.id === s.issueId)
  return (
    <section className="ledger-card mended-card">
      <header>
        <span className="mono caps">Recently mended</span>
        <Icon name="stitch" size={16} />
      </header>
      <Link to={`/stories/${s.id}`} className="mended-pair">
        <figure>
          <Photo src={issue?.photos[0] ?? 'sketch:pothole'} alt="Before" />
          <figcaption className="mono caps">Before</figcaption>
        </figure>
        <figure>
          <Photo src={s.afterPhotos[0]} alt="After" />
          <figcaption className="mono caps">After</figcaption>
        </figure>
      </Link>
      <p className="mended-text">
        <strong>{issue?.title}</strong> — fixed in {s.daysToFix} days for {fmtMoney(s.finalCost)}.
      </p>
      <Link to="/stories" className="link-btn">
        All success stories →
      </Link>
    </section>
  )
}

