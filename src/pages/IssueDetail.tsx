import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { Icon } from '../components/Icon'
import { AiSlip } from '../components/AiPanel'
import { BidForm } from '../components/BidForm'
import { MiniMap } from '../components/Maps'
import { EventLog, LifecycleRail } from '../components/Timeline'
import { VoteRail } from '../components/IssueCard'
import { useActions } from '../components/Actions'
import { Avatar, Button, Empty, FundingTape, Photo, Skeleton, Stamp, toast, Urgency } from '../components/ui'
import { useAddComment, useBids, useComments, useDonations, useEvents, useIssue, useProfiles } from '../data/hooks'
import { useSession } from '../session/SessionContext'
import { CATEGORY_META, fmtCoord, fmtDate, fmtMoney, ROLE_LABEL, ticketRef, timeAgo } from '../lib/format'
import type { Issue } from '../types'

export default function IssueDetail() {
  const { id } = useParams()
  const { data: issue, isLoading } = useIssue(id)
  const { hash } = useLocation()

  useEffect(() => {
    if (hash && issue) document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' })
  }, [hash, issue])

  if (isLoading)
    return (
      <div className="page-grid">
        <div className="col-main"><Skeleton h={560} /></div>
      </div>
    )
  if (!issue)
    return (
      <Empty title="This report doesn’t exist (or was removed)">
        <Link to="/">Back to the ledger</Link>
      </Empty>
    )
  return <Detail issue={issue} />
}

function Detail({ issue }: { issue: Issue }) {
  const { user } = useSession()
  const { byId } = useProfiles()
  const actions = useActions()
  const [photo, setPhoto] = useState(0)
  const author = byId.get(issue.authorId)
  const fundable = issue.status === 'open_for_funding' || issue.status === 'assigned' || issue.status === 'in_progress'

  return (
    <div className="page-grid detail">
      <section className="col-main">
        <Link to="/" className="back-link mono caps">
          <Icon name="left" size={14} /> Ledger
        </Link>

        <article className="dossier">
          <header className="dossier-head">
            <div className="ticket-meta mono">
              <span className="ticket-ref">{ticketRef(issue.ref)}</span>
              <span className="sep">/</span>
              <span>{CATEGORY_META[issue.category].label}</span>
              <span className="sep">/</span>
              <span>{issue.district}</span>
            </div>
            <div className="dossier-title">
              <VoteRail issue={issue} />
              <div>
                <h1>{issue.title}</h1>
                <div className="byline">
                  <Avatar profile={author} size={26} />
                  <span>
                    Reported by <strong>{author?.name ?? 'a citizen'}</strong> · {timeAgo(issue.createdAt)} ago
                  </span>
                  <Urgency level={issue.severity} />
                </div>
              </div>
              <Stamp status={issue.status} />
            </div>
          </header>

          <div className="gallery">
            <figure className="gallery-main snap">
              <Photo src={issue.photos[photo] ?? issue.photos[0]} alt={issue.title} className="snap-img" />
              <figcaption className="snap-cap mono">
                <Icon name="pin" size={12} /> {fmtCoord(issue.location.lat, issue.location.lng)}
                {issue.location.accuracy ? ` · ±${issue.location.accuracy}m` : ''}
              </figcaption>
            </figure>
            {issue.photos.length > 1 && (
              <div className="gallery-thumbs">
                {issue.photos.map((p, i) => (
                  <button key={i} className={i === photo ? 'on' : ''} onClick={() => setPhoto(i)} aria-label={`Photo ${i + 1}`}>
                    <Photo src={p} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <LifecycleRail status={issue.status} />

          <p className="dossier-desc">{issue.description}</p>

          {issue.status === 'rejected' && issue.rejectionReason && (
            <div className="note-err">
              <strong>Closed:</strong> {issue.rejectionReason}
            </div>
          )}

          {issue.status === 'pending_review' && (
            <div className="note-info">
              <Icon name="clock" size={16} />
              {issue.verifiedBy
                ? 'Verified and public. The municipal desk is preparing an official repair-cost estimate — funding opens after that.'
                : 'Waiting for a human reviewer before it appears on the public ledger.'}
            </div>
          )}

          {issue.estimatedCost !== null && (
            <section className="fund-block">
              <div className="fund-head">
                <div>
                  <div className="mono caps muted">Official repair estimate</div>
                  <div className="fund-cost num">{fmtMoney(issue.estimatedCost)}</div>
                </div>
                {fundable && (
                  <Button variant="primary" icon="coin" onClick={() => actions.donate(issue)}>
                    Chip in
                  </Button>
                )}
              </div>
              <FundingTape raised={issue.raised} goal={issue.estimatedCost} donors={issue.donorCount} />
              {issue.costCheck && (
                <p className="mono small muted">
                  <Icon name="scan" size={12} /> Estimate checked by {issue.costCheck.source === 'gemma' ? 'Gemma' : 'rules'}:{' '}
                  {issue.costCheck.reasons[0]}
                </p>
              )}
            </section>
          )}

          {issue.storyId && (
            <Link to={`/stories/${issue.storyId}`} className="story-banner">
              <Icon name="stitch" size={22} />
              <div>
                <strong>Mended.</strong> See the before & after and what it cost.
              </div>
              <Icon name="arrowRight" />
            </Link>
          )}

          <div className="dossier-actions">
            <Button variant="line" icon="share" onClick={() => actions.share(issue)}>
              Share
            </Button>
            <a className="btn btn-ghost" href={`#comments`}>
              <Icon name="comment" size={17} />
              <span>{issue.commentCount} comments</span>
            </a>
            {user?.role === 'admin' && (
              <Link to={`/admin?issue=${issue.id}`} className="btn btn-ink">
                <Icon name="shield" size={17} />
                <span>Open on desk</span>
              </Link>
            )}
          </div>
        </article>

        <Repairs issue={issue} />
        <Comments issue={issue} />
      </section>

      <aside className="col-aside">
        <section className="ledger-card">
          <header>
            <span className="mono caps">Location</span>
            <a
              className="mono link-btn"
              href={`https://www.openstreetmap.org/?mlat=${issue.location.lat}&mlon=${issue.location.lng}#map=18/${issue.location.lat}/${issue.location.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              Open map ↗
            </a>
          </header>
          <MiniMap issue={issue} />
          <p className="small">
            <strong>{issue.address}</strong>
            <br />
            <span className="mono muted">{fmtCoord(issue.location.lat, issue.location.lng)}</span>
          </p>
        </section>

        {issue.ai && <AiSlip a={issue.ai} heading="Intake screening" />}

        <Timeline issueId={issue.id} />
        <Ledger issueId={issue.id} />
      </aside>
    </div>
  )
}

function Timeline({ issueId }: { issueId: string }) {
  const { data = [] } = useEvents(issueId)
  return (
    <section className="ledger-card">
      <header>
        <span className="mono caps">Case log</span>
        <Icon name="clock" size={15} />
      </header>
      <EventLog events={data} />
    </section>
  )
}

function Ledger({ issueId }: { issueId: string }) {
  const { data = [] } = useDonations({ issueId })
  const { byId } = useProfiles()
  if (!data.length) return null
  return (
    <section className="ledger-card">
      <header>
        <span className="mono caps">Donation ledger</span>
        <span className="mono muted">{data.length} entries</span>
      </header>
      <ul className="ledger-list">
        {data.slice(0, 8).map((d) => (
          <li key={d.id}>
            <span>{d.anonymous ? 'Anonymous' : (byId.get(d.userId)?.name ?? 'Neighbour')}</span>
            <span className="mono muted">{timeAgo(d.createdAt)}</span>
            <span className="num">{fmtMoney(d.amount, false)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Repairs({ issue }: { issue: Issue }) {
  const { user } = useSession()
  const { data: bids = [] } = useBids({ issueId: issue.id })
  const { byId } = useProfiles()
  const [open, setOpen] = useState(false)
  const canBid =
    user?.role === 'contractor' &&
    !issue.assignedBidId &&
    (issue.status === 'open_for_funding' || issue.status === 'pending_review') &&
    issue.verifiedBy !== null
  const mine = bids.find((b) => b.contractorId === user?.id && b.status === 'pending')
  const visible = bids.filter((b) => b.status !== 'withdrawn')
  if (!visible.length && !canBid) return null
  return (
    <section className="block">
      <header className="block-head">
        <h2>Repair bids</h2>
        <span className="mono muted">{visible.length} received</span>
      </header>
      {visible.length > 0 && (
        <ul className="bid-list">
          {visible.map((b) => {
            const c = byId.get(b.contractorId)
            return (
              <li key={b.id} className={`bid-row bid-${b.status}`}>
                <Avatar profile={c} size={30} />
                <div className="bid-who">
                  <strong>{c?.company ?? c?.name}</strong>
                  <span className="mono muted">
                    {c?.verified ? 'verified' : 'unverified'} · {b.days} {b.days === 1 ? 'day' : 'days'} · {timeAgo(b.createdAt)} ago
                  </span>
                </div>
                <span className="num bid-amt">{fmtMoney(b.amount)}</span>
                <span className={`pill pill-${b.status}`}>{b.status === 'approved' ? 'Authorised' : b.status}</span>
              </li>
            )
          })}
        </ul>
      )}
      {canBid && !mine && (
        <div className="bid-cta">
          {open ? (
            <BidForm issue={issue} onDone={() => setOpen(false)} />
          ) : (
            <Button variant="ink" icon="hammer" onClick={() => setOpen(true)}>
              Bid to take this job
            </Button>
          )}
        </div>
      )}
      {mine && <p className="muted small">You have a pending bid of {fmtMoney(mine.amount)} on this job.</p>}
    </section>
  )
}

function Comments({ issue }: { issue: Issue }) {
  const { user } = useSession()
  const { data = [] } = useComments(issue.id)
  const { byId } = useProfiles()
  const add = useAddComment(issue.id)
  const [body, setBody] = useState('')
  const post = async () => {
    if (!body.trim()) return
    try {
      await add.mutateAsync(body)
      setBody('')
    } catch (e) {
      toast((e as Error).message, 'err')
    }
  }
  return (
    <section className="block" id="comments">
      <header className="block-head">
        <h2>Discussion</h2>
        <span className="mono muted">{data.length}</span>
      </header>
      <ul className="comments">
        {data.map((c) => {
          const a = byId.get(c.authorId)
          return (
            <li key={c.id} className={`comment ${a?.role === 'admin' ? 'is-official' : ''} ${a?.role === 'contractor' ? 'is-contractor' : ''}`}>
              <Avatar profile={a} size={30} />
              <div>
                <div className="comment-head">
                  <strong>{a?.company ?? a?.name ?? 'Neighbour'}</strong>
                  {a && a.role !== 'citizen' && <span className="badge mono caps">{ROLE_LABEL[a.role]}</span>}
                  <time className="mono muted" title={fmtDate(c.createdAt)}>{timeAgo(c.createdAt)}</time>
                </div>
                <p>{c.body}</p>
              </div>
            </li>
          )
        })}
        {!data.length && <li className="muted">No comments yet — add context, or say you’ve seen it too.</li>}
      </ul>
      {user ? (
        <div className="comment-box">
          <Avatar profile={user} size={30} />
          <textarea
            className="input textarea"
            rows={2}
            placeholder="Add to the record…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && post()}
          />
          <Button variant="ink" icon="send" onClick={post} loading={add.isPending} disabled={!body.trim()} aria-label="Post comment" />
        </div>
      ) : (
        <Link to="/signin">Sign in to comment</Link>
      )}
    </section>
  )
}
