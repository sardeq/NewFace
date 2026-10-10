import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Icon } from '../components/Icon'
import { AiSlip } from '../components/AiPanel'
import { BidForm } from '../components/BidForm'
import { Button, Empty, FundingTape, Photo, Segmented, Sheet, Stamp, toast, Urgency } from '../components/ui'
import { useBids, useIssues, useStartWork, useWithdrawBid } from '../data/hooks'
import { useSession } from '../session/SessionContext'
import { APP } from '../config'
import { CATEGORY_META, fmtDate, fmtMoney, ticketRef, timeAgo } from '../lib/format'
import type { Bid, Issue } from '../types'

type Tab = 'board' | 'bids' | 'orders'

export default function Contractor() {
  const { user } = useSession()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'board'
  const isContractor = user?.role === 'contractor'
  const { data: open = [] } = useIssues({ sort: 'hot', status: 'open_for_funding' })
  const { data: all = [] } = useIssues({ sort: 'new', status: 'all' })
  const { data: mine = [] } = useBids({ contractorId: user?.id ?? '-' }, isContractor)
  const [bidOn, setBidOn] = useState<Issue | null>(null)

  if (!isContractor)
    return (
      <Empty title="Contractor workspace" icon="hardhat">
        Sign in as a contractor or local business to bid on repairs.
      </Empty>
    )

  const orders = mine.filter((b) => b.status === 'approved')
  const pending = mine.filter((b) => b.status === 'pending')
  const bidIssueIds = new Set(pending.map((b) => b.issueId))
  const issueOf = (id: string) => all.find((i) => i.id === id)

  return (
    <div className="works">
      <header className="page-head">
        <h1>Open jobs</h1>
        <p className="page-sub">
          {user.company} · {user.verified ? 'Verified contractor' : 'Verification pending'}
        </p>
      </header>

      <Segmented
        label="Workspace sections"
        value={tab}
        onChange={(t) => setParams({ tab: t })}
        options={[
          { value: 'board', label: 'Job board', icon: 'feed', count: open.filter((i) => !i.assignedBidId).length },
          { value: 'bids', label: 'My bids', icon: 'hammer', count: pending.length },
          { value: 'orders', label: 'Work orders', icon: 'wrench', count: orders.length },
        ]}
      />

      {tab === 'board' && (
        <div className="job-grid">
          {open.filter((i) => !i.assignedBidId).map((i) => (
            <article key={i.id} className="job-card">
              <Photo src={i.photos[0]} alt={i.title} className="job-img" />
              <div className="job-body">
                <div className="ticket-meta mono">
                  <span className="ticket-ref">{ticketRef(i.ref)}</span>
                  <span className="sep">/</span>
                  <span>{CATEGORY_META[i.category].label}</span>
                  <span className="ticket-time">{i.district}</span>
                </div>
                <h3>
                  <Link to={`/issue/${i.id}`}>{i.title}</Link>
                </h3>
                <div className="job-figs">
                  <div>
                    <span className="mono caps muted">Official estimate</span>
                    <strong className="num">{i.estimatedCost ? fmtMoney(i.estimatedCost) : '—'}</strong>
                  </div>
                  <Urgency level={i.severity} />
                </div>
                <FundingTape raised={i.raised} goal={i.estimatedCost} compact />
                {bidIssueIds.has(i.id) ? (
                  <span className="pill pill-pending">Bid submitted</span>
                ) : (
                  <Button variant="ink" size="sm" icon="hammer" onClick={() => setBidOn(i)}>
                    Place a bid
                  </Button>
                )}
              </div>
            </article>
          ))}
          {open.filter((i) => !i.assignedBidId).length === 0 && <Empty title="No open jobs right now" icon="hardhat" />}
        </div>
      )}

      {tab === 'bids' && (
        <ul className="bid-history">
          {mine.length === 0 && <Empty title="No bids yet" icon="hammer" />}
          {mine.map((b) => (
            <BidRow key={b.id} bid={b} issue={issueOf(b.issueId)} />
          ))}
        </ul>
      )}

      {tab === 'orders' && (
        <div className="orders">
          {orders.length === 0 && (
            <Empty title="No work orders yet" icon="wrench">
              When the municipal desk approves one of your bids, your authorisation appears here.
            </Empty>
          )}
          {orders.map((b) => (
            <WorkOrder key={b.id} bid={b} issue={issueOf(b.issueId)} />
          ))}
        </div>
      )}

      <Sheet open={Boolean(bidOn)} onClose={() => setBidOn(null)} kicker={bidOn ? ticketRef(bidOn.ref) : ''} title={bidOn?.title ?? ''} width={560}>
        {bidOn && <BidForm issue={bidOn} />}
      </Sheet>
    </div>
  )
}

function BidRow({ bid, issue }: { bid: Bid; issue?: Issue }) {
  const withdraw = useWithdrawBid()
  return (
    <li className={`bid-hist bid-${bid.status}`}>
      <div className="bid-hist-main">
        <div className="mono muted">
          {issue ? ticketRef(issue.ref) : ''} · {timeAgo(bid.createdAt)}
        </div>
        <Link to={`/issue/${bid.issueId}`}>
          <strong>{issue?.title ?? 'Issue'}</strong>
        </Link>
        <div className="mono">
          {fmtMoney(bid.amount)} · {bid.days} {bid.days === 1 ? 'day' : 'days'}
        </div>
        {bid.decisionNote && <p className="small muted">Desk: “{bid.decisionNote}”</p>}
      </div>
      {bid.ai && <AiSlip a={bid.ai} heading="Gemma review" compact />}
      <div className="bid-hist-side">
        <span className={`pill pill-${bid.status}`}>{bid.status === 'approved' ? 'Authorised' : bid.status}</span>
        {bid.status === 'pending' && (
          <Button variant="ghost" size="sm" loading={withdraw.isPending} onClick={() => withdraw.mutateAsync(bid.id).then(() => toast('Bid withdrawn'))}>
            Withdraw
          </Button>
        )}
      </div>
    </li>
  )
}

/** The work authorisation — styled like a municipal permit. */
function WorkOrder({ bid, issue }: { bid: Bid; issue?: Issue }) {
  const { user } = useSession()
  const start = useStartWork()
  if (!issue) return null
  return (
    <article className="permit">
      <header className="permit-head">
        <div>
          <div className="mono caps">{APP.city} municipal desk · work authorisation</div>
          <h2 className="mono">{bid.authorization}</h2>
        </div>
        <Stamp status={issue.status} />
      </header>
      <div className="permit-grid">
        <Photo src={issue.photos[0]} alt={issue.title} className="permit-img" />
        <dl className="permit-rows">
          <div><dt className="mono caps">Job</dt><dd><Link to={`/issue/${issue.id}`}>{ticketRef(issue.ref)} — {issue.title}</Link></dd></div>
          <div><dt className="mono caps">Site</dt><dd>{issue.address}, {issue.district}</dd></div>
          <div><dt className="mono caps">Authorised to</dt><dd>{user?.company}</dd></div>
          <div><dt className="mono caps">Contract value</dt><dd className="num">{fmtMoney(bid.amount)}</dd></div>
          <div><dt className="mono caps">Duration</dt><dd className="num">{bid.days} working days</dd></div>
          <div><dt className="mono caps">Approved</dt><dd>{bid.decidedAt ? fmtDate(bid.decidedAt) : '—'}</dd></div>
        </dl>
      </div>
      {bid.decisionNote && <p className="permit-note">“{bid.decisionNote}”</p>}
      <footer className="permit-foot">
        {issue.status === 'assigned' ? (
          <Button variant="primary" icon="wrench" loading={start.isPending} onClick={() => start.mutateAsync({ issueId: issue.id, note: `${user?.company} crew on site.` }).then(() => toast('Marked as in progress — residents notified'))}>
            Start physical work
          </Button>
        ) : issue.status === 'in_progress' ? (
          <span className="mono">Work in progress — the desk will sign off with after photos.</span>
        ) : issue.status === 'resolved' ? (
          <Link to={`/stories/${issue.storyId}`} className="btn btn-moss">
            <Icon name="stitch" size={16} />
            <span>Signed off — view story</span>
          </Link>
        ) : null}
        <span className="permit-sign mono">signed · municipal desk</span>
      </footer>
    </article>
  )
}
