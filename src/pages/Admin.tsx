import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Icon } from '../components/Icon'
import { AiSlip } from '../components/AiPanel'
import { EventLog, LifecycleRail } from '../components/Timeline'
import { MiniMap } from '../components/Maps'
import { sketchForCategory } from '../components/Sketch'
import { Avatar, Button, Empty, Field, FundingTape, Photo, Segmented, Skeleton, Stamp, toast, Urgency } from '../components/ui'
import { useBids, useDecideBid, useEvents, useProfiles, useQueue, useResolveIssue, useStartWork, useUpdateIssue } from '../data/hooks'
import { useSession } from '../session/SessionContext'
import { APP } from '../config'
import { costAutoApproved, screenCost } from '../lib/ai'
import { compressImage } from '../lib/media'
import { CATEGORIES, CATEGORY_META, fmtMoney, LIFECYCLE, STATUS_META, ticketRef, timeAgo } from '../lib/format'
import type { Bid, CostAssessment, Issue, IssueStatus } from '../types'

type Tab = 'triage' | 'funding' | 'bids' | 'work' | 'closed'

export default function Admin() {
  const { user } = useSession()
  const [params, setParams] = useSearchParams()
  const isAdmin = user?.role === 'admin'
  const { data: queue = [], isLoading } = useQueue(isAdmin)
  const { data: pendingBids = [] } = useBids({ status: 'pending' }, isAdmin)
  const tab = (params.get('tab') as Tab) || 'triage'
  const selectedId = params.get('issue')

  const groups = useMemo(() => {
    const by = (...s: IssueStatus[]) => queue.filter((i) => s.includes(i.status))
    const triage = by('pending_review').sort((a, b) => Number(Boolean(a.verifiedBy)) - Number(Boolean(b.verifiedBy)))
    return {
      triage,
      funding: by('open_for_funding'),
      work: by('assigned', 'in_progress'),
      closed: by('resolved', 'rejected'),
    }
  }, [queue])

  // When a deep-link names an issue, jump to the tab it lives in.
  useEffect(() => {
    if (!selectedId || !queue.length || params.get('tab')) return
    const i = queue.find((x) => x.id === selectedId)
    if (!i) return
    const t: Tab =
      i.status === 'pending_review' ? 'triage' : i.status === 'open_for_funding' ? 'funding' : i.status === 'resolved' || i.status === 'rejected' ? 'closed' : 'work'
    setParams({ tab: t, issue: selectedId }, { replace: true })
  }, [selectedId, queue, params, setParams])

  if (!isAdmin)
    return (
      <Empty title="Municipal desk only" icon="shield">
        This area is for government reviewers.
      </Empty>
    )

  const list = tab === 'bids' ? [] : groups[tab]
  const selected = queue.find((i) => i.id === selectedId) ?? list[0]
  const select = (id: string) => setParams({ tab, issue: id })

  return (
    <div className="desk">
      <header className="page-head desk-head">
        <div>
          <h1>Today’s docket</h1>
          <p className="page-sub">
            {APP.city} municipal desk · {groups.triage.length + pendingBids.length} items need a decision
          </p>
        </div>
      </header>

      <Segmented
        label="Desk sections"
        value={tab}
        onChange={(t) => setParams({ tab: t })}
        options={[
          { value: 'triage', label: 'Triage', icon: 'flag', count: groups.triage.length },
          { value: 'funding', label: 'Funding', icon: 'coin', count: groups.funding.length },
          { value: 'bids', label: 'Bids', icon: 'hammer', count: pendingBids.length },
          { value: 'work', label: 'Work', icon: 'wrench', count: groups.work.length },
          { value: 'closed', label: 'Closed', icon: 'check', count: groups.closed.length },
        ]}
      />

      {isLoading ? (
        <Skeleton h={500} />
      ) : tab === 'bids' ? (
        <BidsBoard bids={pendingBids} issues={queue} />
      ) : list.length === 0 ? (
        <Empty title="Clear desk" icon="check">
          Nothing in this tray.
        </Empty>
      ) : (
        <div className="desk-grid">
          <ul className="docket">
            {list.map((i) => (
              <li key={i.id}>
                <button className={`docket-row ${selected?.id === i.id ? 'on' : ''}`} onClick={() => select(i.id)}>
                  <Photo src={i.photos[0]} alt="" className="docket-thumb" />
                  <span className="docket-text">
                    <span className="mono muted">
                      {ticketRef(i.ref)} · {timeAgo(i.createdAt)}
                    </span>
                    <strong>{i.title}</strong>
                    <span className="docket-flags">
                      {i.status === 'pending_review' && !i.verifiedBy && <span className="flag flag-review mono caps">needs human</span>}
                      {i.verifiedBy === 'ai' && i.status === 'pending_review' && <span className="flag flag-ai mono caps">AI-verified · needs cost</span>}
                      {i.status !== 'pending_review' && <Stamp status={i.status} small />}
                      <Urgency level={i.severity} label={false} />
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {selected && <CaseFile key={selected.id} issue={selected} />}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────── case file ─────────────────────────── */

function CaseFile({ issue }: { issue: Issue }) {
  const { byId } = useProfiles()
  const { data: events = [] } = useEvents(issue.id)
  const update = useUpdateIssue()
  const author = byId.get(issue.authorId)
  const [category, setCategory] = useState(issue.category)
  const [severity, setSeverity] = useState(issue.severity)
  const [title, setTitle] = useState(issue.title)
  const dirty = category !== issue.category || severity !== issue.severity || title !== issue.title

  const saveTriage = async () => {
    await update.mutateAsync({ id: issue.id, patch: { category, severity, title, note: 'Categorised by the municipal desk.' } })
    toast('Triage saved')
  }

  return (
    <section className="casefile">
      <header className="casefile-head">
        <div className="mono caps muted">
          Case file {ticketRef(issue.ref)} · filed {timeAgo(issue.createdAt)} ago by {author?.name}
        </div>
        <Link to={`/issue/${issue.id}`} className="mono link-btn">
          Public page ↗
        </Link>
      </header>

      <div className="casefile-top">
        <Photo src={issue.photos[0]} alt={issue.title} className="casefile-photo" />
        <div className="casefile-map">
          <MiniMap issue={issue} />
          <p className="small">
            <Icon name="pin" size={13} /> {issue.address}, {issue.district}
          </p>
        </div>
      </div>

      <LifecycleRail status={issue.status} />

      <blockquote className="casefile-quote">“{issue.description}”</blockquote>

      {issue.ai && <AiSlip a={issue.ai} heading="Gemma intake screening" />}

      <fieldset className="panel">
        <legend className="mono caps">1 · Review & categorise</legend>
        <Field label="Public headline">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="two-col">
          <Field label="Category">
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value as Issue['category'])}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_META[c].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Severity">
            <div className="sev-pick">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={n === severity ? 'on' : ''} onClick={() => setSeverity(n)}>
                  {n}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <div className="row-gap">
          <Button variant="line" size="sm" disabled={!dirty} loading={update.isPending} onClick={saveTriage}>
            Save triage
          </Button>
          {issue.status === 'pending_review' && !issue.verifiedBy && (
            <Button
              variant="moss"
              size="sm"
              icon="check"
              onClick={() =>
                update.mutateAsync({ id: issue.id, patch: { category, severity, title, verifiedBy: 'admin', note: 'Verified by a reviewer and published.' } }).then(() => toast('Published to the ledger'))
              }
            >
              Verify & publish
            </Button>
          )}
          {issue.status !== 'rejected' && issue.status !== 'resolved' && <RejectButton issue={issue} />}
        </div>
      </fieldset>

      {(issue.status === 'pending_review' || issue.status === 'open_for_funding') && <CostPanel issue={issue} />}
      {(issue.status === 'assigned' || issue.status === 'in_progress') && <WorkPanel issue={issue} />}
      {issue.status === 'in_progress' && <ResolvePanel issue={issue} />}

      <StatusOverride issue={issue} />

      <fieldset className="panel">
        <legend className="mono caps">Case log</legend>
        <EventLog events={events} />
      </fieldset>
    </section>
  )
}

function RejectButton({ issue }: { issue: Issue }) {
  const update = useUpdateIssue()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState(issue.ai?.verdict === 'reject' ? issue.ai.reasons[0] ?? '' : '')
  if (!open)
    return (
      <Button variant="ghost" size="sm" icon="x" onClick={() => setOpen(true)}>
        Close as not actionable
      </Button>
    )
  return (
    <div className="inline-form">
      <input className="input" placeholder="Reason shown to the reporter" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      <Button
        variant="danger"
        size="sm"
        disabled={!reason.trim()}
        onClick={() =>
          update
            .mutateAsync({ id: issue.id, patch: { status: 'rejected', rejectionReason: reason, note: reason } })
            .then(() => toast('Report closed'))
        }
      >
        Close
      </Button>
    </div>
  )
}

/** Cost estimate → Gemma checks it → fundraising opens automatically when it agrees. */
function CostPanel({ issue }: { issue: Issue }) {
  const update = useUpdateIssue()
  const [cost, setCost] = useState(String(issue.estimatedCost ?? issue.ai?.costRange[1] ?? ''))
  const [check, setCheck] = useState<CostAssessment | null>(null)
  const [checking, setChecking] = useState(false)
  const range = issue.ai?.costRange
  const n = Number(cost)

  const open = async (c: CostAssessment, override = false) => {
    await update.mutateAsync({
      id: issue.id,
      patch: {
        estimatedCost: n,
        costCheck: c,
        status: 'open_for_funding',
        note: override
          ? `Official estimate ${fmtMoney(n)}. Opened by reviewer override (Gemma: ${c.verdict}).`
          : `Official estimate ${fmtMoney(n)}. Approved for fundraising by Gemma.`,
      },
    })
    toast('Fundraising is open')
    setCheck(null)
  }

  const submit = async () => {
    setChecking(true)
    try {
      const c = await screenCost({ issue, estimatedCost: n })
      setCheck(c)
      if (costAutoApproved(c)) await open(c)
    } finally {
      setChecking(false)
    }
  }

  const isOpen = issue.status === 'open_for_funding'
  return (
    <fieldset className="panel">
      <legend className="mono caps">2 · {isOpen ? 'Funding campaign' : 'Repair estimate & fundraising'}</legend>
      {isOpen && <FundingTape raised={issue.raised} goal={issue.estimatedCost} donors={issue.donorCount} />}
      <div className="cost-row">
        <Field
          label={`Estimated repair cost · ${APP.currency}`}
          hint={range ? `Gemma’s range for this report: ${fmtMoney(range[0])}–${fmtMoney(range[1], false)}` : undefined}
        >
          <input className="input input-xl num" inputMode="decimal" value={cost} onChange={(e) => (setCost(e.target.value.replace(/[^\d.]/g, '')), setCheck(null))} />
        </Field>
        {range && n > 0 && <RangeGauge range={range} value={n} />}
      </div>
      <div className="row-gap">
        <Button variant="primary" icon="scan" disabled={!(n > 0) || (isOpen && n === issue.estimatedCost)} loading={checking || update.isPending} onClick={submit}>
          {isOpen ? 'Re-check & update estimate' : 'Check with Gemma & open funding'}
        </Button>
      </div>
      {check && !costAutoApproved(check) && (
        <div className="override">
          <AiSlip a={check} heading="Gemma cost check" compact outcome="Gemma did not auto-approve this campaign. Revise the figure, or open it with a reviewer override (logged publicly)." />
          <Button variant="line" size="sm" icon="flag" onClick={() => open(check, true)}>
            Override & open funding
          </Button>
        </div>
      )}
    </fieldset>
  )
}

function RangeGauge({ range, value }: { range: [number, number]; value: number }) {
  const max = Math.max(range[1] * 1.6, value * 1.1)
  const x = (v: number) => `${Math.min(100, (v / max) * 100)}%`
  return (
    <div className="range-gauge" aria-hidden>
      <div className="rg-track">
        <div className="rg-band" style={{ left: x(range[0]), width: `calc(${x(range[1])} - ${x(range[0])})` }} />
        <div className="rg-mark" style={{ left: x(value) }} />
      </div>
      <div className="rg-labels mono">
        <span>0</span>
        <span>AI range</span>
        <span>{Math.round(max)}</span>
      </div>
    </div>
  )
}

function WorkPanel({ issue }: { issue: Issue }) {
  const { data: bids = [] } = useBids({ issueId: issue.id })
  const { byId } = useProfiles()
  const start = useStartWork()
  const bid = bids.find((b) => b.id === issue.assignedBidId)
  const c = bid ? byId.get(bid.contractorId) : null
  return (
    <fieldset className="panel">
      <legend className="mono caps">3 · Authorised work</legend>
      {bid ? (
        <div className="auth-line">
          <Avatar profile={c} size={34} />
          <div>
            <strong>{c?.company}</strong>
            <div className="mono muted">
              {bid.authorization} · {fmtMoney(bid.amount)} · {bid.days} days
            </div>
          </div>
          {issue.status === 'assigned' && (
            <Button variant="line" size="sm" icon="wrench" loading={start.isPending} onClick={() => start.mutate({ issueId: issue.id, note: 'Crew on site (confirmed by desk).' })}>
              Mark in progress
            </Button>
          )}
        </div>
      ) : (
        <p className="muted">No contractor bid — handled by a municipal crew.</p>
      )}
    </fieldset>
  )
}

/** After photos + summary → Success Story post that references the original issue. */
function ResolvePanel({ issue }: { issue: Issue }) {
  const resolve = useResolveIssue()
  const { data: bids = [] } = useBids({ issueId: issue.id })
  const bid = bids.find((b) => b.id === issue.assignedBidId)
  const [after, setAfter] = useState<string[]>([])
  const [summary, setSummary] = useState('')
  const [cost, setCost] = useState(String(bid?.amount ?? issue.estimatedCost ?? ''))
  const fileRef = useRef<HTMLInputElement>(null)

  const add = async (files: FileList | null) => {
    if (!files) return
    const next = await Promise.all(Array.from(files).slice(0, 4).map((f) => compressImage(f)))
    setAfter((a) => [...a, ...next].slice(0, 4))
  }
  const publish = async () => {
    await resolve.mutateAsync({ issueId: issue.id, afterPhotos: after.length ? after : [`sketch:${sketchForCategory(issue.category)}:fixed`], summary, finalCost: Number(cost) })
    toast('Success story published')
  }
  return (
    <fieldset className="panel panel-resolve">
      <legend className="mono caps">4 · Sign off & publish success story</legend>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => add(e.target.files)} />
      <div className="after-grid">
        <figure>
          <Photo src={issue.photos[0]} alt="Before" />
          <figcaption className="mono caps">Before</figcaption>
        </figure>
        {after.map((a, i) => (
          <figure key={i}>
            <img src={a} alt={`After ${i + 1}`} />
            <figcaption className="mono caps">After {i + 1}</figcaption>
          </figure>
        ))}
        {after.length < 4 && (
          <button className="capture capture-sm" onClick={() => fileRef.current?.click()}>
            <Icon name="camera" size={22} />
            <span>Add “after” photo</span>
          </button>
        )}
      </div>
      <Field label="What was done" hint="Shown publicly on the success story.">
        <textarea className="input textarea" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </Field>
      <Field label={`Final cost · ${APP.currency}`}>
        <input className="input num" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value.replace(/[^\d.]/g, ''))} />
      </Field>
      <Button variant="moss" icon="stitch" disabled={summary.trim().length < 10 || !(Number(cost) >= 0)} loading={resolve.isPending} onClick={publish}>
        Resolve & publish story
      </Button>
      {!after.length && <p className="small muted">No after photo? A field sketch stands in — real photos build far more trust.</p>}
    </fieldset>
  )
}

function StatusOverride({ issue }: { issue: Issue }) {
  const update = useUpdateIssue()
  const [status, setStatus] = useState<IssueStatus>(issue.status)
  const [note, setNote] = useState('')
  return (
    <details className="panel panel-override">
      <summary className="mono caps">Manual status override</summary>
      <div className="inline-form">
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value as IssueStatus)}>
          {[...LIFECYCLE, 'rejected' as const].map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
        <input className="input" placeholder="Public note for the case log" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button
          variant="ink"
          size="sm"
          disabled={status === issue.status}
          loading={update.isPending}
          onClick={() => update.mutateAsync({ id: issue.id, patch: { status, note } }).then(() => toast('Status updated'))}
        >
          Apply
        </Button>
      </div>
    </details>
  )
}

/* ─────────────────────────── bids board ─────────────────────────── */

function BidsBoard({ bids, issues }: { bids: Bid[]; issues: Issue[] }) {
  const { byId } = useProfiles()
  const decide = useDecideBid()
  const [notes, setNotes] = useState<Record<string, string>>({})
  if (!bids.length)
    return (
      <Empty title="No bids waiting" icon="hammer">
        Contractors bid from an issue’s public page.
      </Empty>
    )
  const byIssue = new Map<string, Bid[]>()
  bids.forEach((b) => byIssue.set(b.issueId, [...(byIssue.get(b.issueId) ?? []), b]))
  return (
    <div className="bids-board">
      {[...byIssue.entries()].map(([issueId, list]) => {
        const issue = issues.find((i) => i.id === issueId)
        if (!issue) return null
        return (
          <section key={issueId} className="bid-group">
            <header className="bid-group-head">
              <Photo src={issue.photos[0]} alt="" className="docket-thumb" />
              <div>
                <div className="mono muted">
                  {ticketRef(issue.ref)} · estimate {issue.estimatedCost ? fmtMoney(issue.estimatedCost) : '—'} · raised {fmtMoney(issue.raised)}
                </div>
                <Link to={`/admin?issue=${issue.id}`}>
                  <strong>{issue.title}</strong>
                </Link>
              </div>
              <Stamp status={issue.status} small />
            </header>
            <div className="bid-cards">
              {list
                .sort((a, b) => (b.ai?.score ?? 0) - (a.ai?.score ?? 0))
                .map((b, idx) => {
                  const c = byId.get(b.contractorId)
                  const delta = issue.estimatedCost ? Math.round(((b.amount - issue.estimatedCost) / issue.estimatedCost) * 100) : null
                  return (
                    <article key={b.id} className={`bid-card ${idx === 0 && b.ai?.verdict === 'accept' ? 'is-top' : ''}`}>
                      {idx === 0 && b.ai?.verdict === 'accept' && <span className="bid-ribbon mono caps">Gemma’s pick</span>}
                      <header>
                        <Avatar profile={c} size={34} />
                        <div>
                          <strong>{c?.company ?? c?.name}</strong>
                          <div className="mono muted">{c?.verified ? 'Verified contractor' : 'Unverified'}</div>
                        </div>
                      </header>
                      <div className="bid-figs">
                        <div>
                          <span className="mono caps muted">Price</span>
                          <strong className="num">{fmtMoney(b.amount)}</strong>
                          {delta !== null && (
                            <span className={`mono delta ${delta > 0 ? 'up' : 'down'}`}>
                              {delta > 0 ? '+' : ''}
                              {delta}% vs est.
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="mono caps muted">Time</span>
                          <strong className="num">{b.days} d</strong>
                        </div>
                      </div>
                      <p className="bid-msg">{b.message}</p>
                      {b.ai && <AiSlip a={b.ai} heading="Gemma bid review" compact />}
                      <input
                        className="input"
                        placeholder="Decision note (sent to contractor)"
                        value={notes[b.id] ?? ''}
                        onChange={(e) => setNotes({ ...notes, [b.id]: e.target.value })}
                      />
                      <div className="row-gap">
                        <Button
                          variant="moss"
                          size="sm"
                          icon="check"
                          loading={decide.isPending && decide.variables?.bidId === b.id && decide.variables.approve}
                          onClick={() =>
                            decide.mutateAsync({ bidId: b.id, approve: true, note: notes[b.id] ?? '' }).then(() => toast('Approved — contractor notified and authorised'))
                          }
                        >
                          Approve & authorise
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon="x"
                          onClick={() => decide.mutateAsync({ bidId: b.id, approve: false, note: notes[b.id] ?? '' }).then(() => toast('Bid declined'))}
                        >
                          Decline
                        </Button>
                      </div>
                    </article>
                  )
                })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
