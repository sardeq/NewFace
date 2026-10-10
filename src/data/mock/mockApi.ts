import type { Api } from '../api'
import type {
  AdminIssuePatch,
  AppNotification,
  Bid,
  Issue,
  IssueStatus,
  NotificationKind,
  StatusEvent,
} from '../../types'
import { buildSeed, DB_VERSION, type MockDb } from './seed'
import { distanceKm, fmtMoney, hotScore, pct, STATUS_META, ticketRef, txnRef, uid } from '../../lib/format'
import { intakeOutcome } from '../../lib/ai'

const KEY = 'matab.mockdb'
const latency = () => new Promise((r) => setTimeout(r, 120 + Math.random() * 180))
const now = () => new Date().toISOString()
const clone = <T,>(v: T): T => structuredClone(v)

function load(): MockDb {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const db = JSON.parse(raw) as MockDb
      if (db.version === DB_VERSION) return db
    }
  } catch {
    /* storage unavailable or corrupt → reseed */
  }
  return buildSeed()
}

export class MockApi implements Api {
  readonly mode = 'mock' as const
  private db: MockDb = load()
  private viewer: string | null = null

  setViewer(id: string | null) {
    this.viewer = id
  }

  /** Wipe local changes and restore the seeded demo city. */
  reset() {
    this.db = buildSeed()
    this.save()
  }

  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.db))
    } catch {
      // Quota exceeded (large photos) — keep working in memory.
    }
  }

  private me() {
    const p = this.db.profiles.find((x) => x.id === this.viewer)
    if (!p) throw new Error('Sign in to do that.')
    return p
  }

  private requireRole(...roles: Array<'citizen' | 'admin' | 'contractor'>) {
    const p = this.me()
    if (!roles.includes(p.role)) throw new Error('You do not have permission for this action.')
    return p
  }

  private issueOrThrow(id: string) {
    const i = this.db.issues.find((x) => x.id === id)
    if (!i) throw new Error('Issue not found')
    return i
  }

  /** Attach viewer-relative fields and derived money totals. */
  private view(i: Issue): Issue {
    const dons = this.db.donations.filter((d) => d.issueId === i.id)
    const raised = dons.reduce((s, d) => s + d.amount, 0)
    return {
      ...clone(i),
      raised,
      donorCount: new Set(dons.map((d) => d.userId)).size,
      commentCount: this.db.comments.filter((c) => c.issueId === i.id).length,
      myVote: (this.viewer && this.db.votes[i.id]?.[this.viewer]) || 0,
    }
  }

  private notify(userId: string, kind: NotificationKind, title: string, body: string, link: string) {
    const n: AppNotification = { id: uid('n_'), userId, kind, title, body, link, read: false, at: now() }
    this.db.notifications.unshift(n)
  }

  private event(issueId: string, status: IssueStatus, note: string) {
    const e: StatusEvent = { id: uid('e_'), issueId, status, note, actorId: this.viewer ?? 'system', at: now() }
    this.db.events.push(e)
  }

  private setStatus(i: Issue, status: IssueStatus, note: string) {
    if (i.status === status) return
    i.status = status
    i.updatedAt = now()
    this.event(i.id, status, note)
    this.notify(
      i.authorId,
      'status',
      `${ticketRef(i.ref)} is now “${STATUS_META[status].label}”`,
      note || i.title,
      `/issue/${i.id}`,
    )
  }

  // ───────── people ─────────
  async listProfiles() {
    await latency()
    return clone(this.db.profiles)
  }
  async getProfile(id: string) {
    await latency()
    return clone(this.db.profiles.find((p) => p.id === id) ?? null)
  }
  async contractorJobsDone(id: string) {
    return this.db.stories.filter((s) => s.contractorId === id).length +
      // seed history so verified crews look established
      (id === 'u_nabulsi' ? 12 : id === 'u_sahel' ? 7 : 0)
  }

  // ───────── issues ─────────
  async listIssues(q: import('../../types').FeedQuery) {
    await latency()
    let list = this.db.issues.filter((i) => {
      if (q.authorId) return i.authorId === q.authorId
      // Public feed: only verified (AI or admin) and not rejected.
      return i.verifiedBy !== null && i.status !== 'rejected'
    })
    if (q.status && q.status !== 'all') {
      list =
        q.status === 'active'
          ? list.filter((i) => i.status !== 'resolved' && i.status !== 'rejected')
          : list.filter((i) => i.status === q.status)
    }
    if (q.category && q.category !== 'all') list = list.filter((i) => i.category === q.category)
    const views = list.map((i) => this.view(i))
    switch (q.sort) {
      case 'new':
        views.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        break
      case 'top':
        views.sort((a, b) => b.upvotes - b.downvotes - (a.upvotes - a.downvotes))
        break
      case 'near':
        if (q.near) {
          const p = q.near
          views.sort((a, b) => distanceKm(p, a.location) - distanceKm(p, b.location))
        }
        break
      case 'funding':
        return views
          .filter((i) => i.status === 'open_for_funding')
          .sort((a, b) => pct(b.raised, b.estimatedCost) - pct(a.raised, a.estimatedCost))
      default:
        views.sort((a, b) => hotScore(b) - hotScore(a))
    }
    return views
  }

  async getIssue(id: string) {
    await latency()
    const i = this.db.issues.find((x) => x.id === id)
    return i ? this.view(i) : null
  }

  async uploadPhoto(dataUrl: string) {
    return dataUrl
  }

  async createIssue(input: import('../../types').NewIssueInput) {
    await latency()
    const me = this.me()
    const outcome = intakeOutcome(input.ai)
    const issue: Issue = {
      id: uid('i_'),
      ref: this.db.refSeq++,
      authorId: me.id,
      title: input.ai.title,
      description: input.description,
      category: input.ai.category,
      severity: input.ai.severity,
      status: outcome === 'rejected' ? 'rejected' : 'pending_review',
      location: input.location,
      address: input.address,
      district: input.district,
      photos: input.photos,
      createdAt: now(),
      updatedAt: now(),
      upvotes: 1,
      downvotes: 0,
      commentCount: 0,
      estimatedCost: null,
      raised: 0,
      donorCount: 0,
      ai: input.ai,
      costCheck: null,
      assignedBidId: null,
      storyId: null,
      verifiedBy: outcome === 'published' ? 'ai' : null,
      rejectionReason: outcome === 'rejected' ? input.ai.reasons[0] ?? 'Not an infrastructure issue.' : null,
    }
    this.db.issues.unshift(issue)
    this.db.votes[issue.id] = { [me.id]: 1 }
    this.db.events.push({
      id: uid('e_'),
      issueId: issue.id,
      status: 'pending_review',
      note:
        outcome === 'published'
          ? `Auto-verified by Gemma (${Math.round(input.ai.confidence * 100)}% confidence). Waiting for a cost estimate.`
          : outcome === 'rejected'
            ? 'Screened out by Gemma. The author can appeal.'
            : 'Gemma was unsure — queued for a human reviewer.',
      actorId: 'system',
      at: now(),
    })
    if (outcome === 'rejected') this.event(issue.id, 'rejected', issue.rejectionReason ?? '')
    this.save()
    return this.view(issue)
  }

  async vote(issueId: string, value: -1 | 0 | 1) {
    await latency()
    const me = this.me()
    const i = this.issueOrThrow(issueId)
    const box = (this.db.votes[issueId] ??= {})
    const prev = box[me.id] ?? 0
    if (prev === 1) i.upvotes--
    if (prev === -1) i.downvotes--
    if (value === 0) delete box[me.id]
    else box[me.id] = value
    if (value === 1) i.upvotes++
    if (value === -1) i.downvotes++
    this.save()
    return this.view(i)
  }

  async listEvents(issueId: string) {
    await latency()
    return clone(this.db.events.filter((e) => e.issueId === issueId)).sort((a, b) => a.at.localeCompare(b.at))
  }

  async stats() {
    await latency()
    const resolved = this.db.issues.filter((i) => i.status === 'resolved')
    return {
      reported: this.db.issues.filter((i) => i.status !== 'rejected').length,
      resolved: resolved.length,
      raised: this.db.donations.reduce((s, d) => s + d.amount, 0),
      openForFunding: this.db.issues.filter((i) => i.status === 'open_for_funding').length,
      avgDaysToFix: this.db.stories.length
        ? Math.round(this.db.stories.reduce((s, x) => s + x.daysToFix, 0) / this.db.stories.length)
        : 0,
    }
  }

  // ───────── conversation ─────────
  async listComments(issueId: string) {
    await latency()
    return clone(this.db.comments.filter((c) => c.issueId === issueId)).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    )
  }

  async addComment(issueId: string, body: string) {
    await latency()
    const me = this.me()
    const i = this.issueOrThrow(issueId)
    const c = { id: uid('c_'), issueId, authorId: me.id, body: body.trim(), createdAt: now() }
    this.db.comments.push(c)
    if (i.authorId !== me.id)
      this.notify(i.authorId, 'comment', `${me.name} commented on ${ticketRef(i.ref)}`, `“${c.body.slice(0, 80)}”`, `/issue/${i.id}`)
    this.save()
    return clone(c)
  }

  async shareInternal(issueId: string, toUserId: string, note: string) {
    await latency()
    const me = this.me()
    const i = this.issueOrThrow(issueId)
    this.notify(toUserId, 'share', `${me.name} sent you ${ticketRef(i.ref)}`, note || i.title, `/issue/${i.id}`)
    this.save()
  }

  // ───────── money ─────────
  async donate(issueId: string, amount: number, opts: { anonymous: boolean; method: string }) {
    await new Promise((r) => setTimeout(r, 900)) // gateway round-trip
    const me = this.me()
    const i = this.issueOrThrow(issueId)
    if (i.status !== 'open_for_funding' && i.status !== 'assigned' && i.status !== 'in_progress')
      throw new Error('This issue is not accepting donations right now.')
    if (!(amount > 0)) throw new Error('Enter an amount above zero.')
    const d = { id: uid('d_'), issueId, userId: me.id, amount, anonymous: opts.anonymous, method: opts.method, reference: txnRef(), createdAt: now() }
    this.db.donations.push(d)
    const raised = this.db.donations.filter((x) => x.issueId === issueId).reduce((s, x) => s + x.amount, 0)
    if (i.authorId !== me.id)
      this.notify(i.authorId, 'donation', `${opts.anonymous ? 'Someone' : me.name} donated ${fmtMoney(amount)}`, `${ticketRef(i.ref)} is ${pct(raised, i.estimatedCost)}% funded.`, `/issue/${i.id}`)
    this.save()
    return clone(d)
  }

  async listDonations(f: { issueId?: string; userId?: string }) {
    await latency()
    return clone(
      this.db.donations.filter((d) => (!f.issueId || d.issueId === f.issueId) && (!f.userId || d.userId === f.userId)),
    ).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  // ───────── admin ─────────
  async listQueue() {
    await latency()
    this.requireRole('admin')
    return this.db.issues.map((i) => this.view(i)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async updateIssue(id: string, patch: AdminIssuePatch) {
    await latency()
    this.requireRole('admin')
    const i = this.issueOrThrow(id)
    if (patch.category) i.category = patch.category
    if (patch.severity) i.severity = patch.severity
    if (patch.title) i.title = patch.title
    if (patch.estimatedCost !== undefined) i.estimatedCost = patch.estimatedCost
    if (patch.costCheck !== undefined) i.costCheck = patch.costCheck
    if (patch.verifiedBy !== undefined) i.verifiedBy = patch.verifiedBy
    if (patch.rejectionReason !== undefined) i.rejectionReason = patch.rejectionReason
    if (patch.status) {
      if (patch.status !== 'rejected' && patch.status !== 'pending_review' && !i.verifiedBy) i.verifiedBy = 'admin'
      this.setStatus(i, patch.status, patch.note ?? '')
    } else if (patch.note) {
      this.event(i.id, i.status, patch.note)
    }
    i.updatedAt = now()
    this.save()
    return this.view(i)
  }

  async resolveIssue(issueId: string, input: { afterPhotos: string[]; summary: string; finalCost: number }) {
    await latency()
    this.requireRole('admin')
    const i = this.issueOrThrow(issueId)
    const bid = this.db.bids.find((b) => b.id === i.assignedBidId)
    const story = {
      id: uid('s_'),
      issueId,
      afterPhotos: input.afterPhotos,
      summary: input.summary,
      finalCost: input.finalCost,
      daysToFix: Math.max(1, Math.round((Date.now() - new Date(i.createdAt).getTime()) / 864e5)),
      contractorId: bid?.contractorId ?? null,
      createdAt: now(),
    }
    this.db.stories.unshift(story)
    i.storyId = story.id
    this.setStatus(i, 'resolved', 'Repair verified. Success story published.')
    const donors = new Set(this.db.donations.filter((d) => d.issueId === issueId).map((d) => d.userId))
    donors.forEach((u) =>
      this.notify(u, 'story', `Fixed: ${i.title}`, 'A repair you helped fund is complete.', `/stories/${story.id}`),
    )
    if (bid) this.notify(bid.contractorId, 'story', `Job signed off · ${ticketRef(i.ref)}`, 'The municipal desk verified your work.', `/stories/${story.id}`)
    this.save()
    return clone(story)
  }

  // ───────── contractors ─────────
  async listBids(f: { issueId?: string; contractorId?: string; status?: Bid['status'] }) {
    await latency()
    return clone(
      this.db.bids.filter(
        (b) =>
          (!f.issueId || b.issueId === f.issueId) &&
          (!f.contractorId || b.contractorId === f.contractorId) &&
          (!f.status || b.status === f.status),
      ),
    ).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async submitBid(issueId: string, input: { amount: number; days: number; message: string; ai: Bid['ai'] }) {
    await latency()
    const me = this.requireRole('contractor')
    const i = this.issueOrThrow(issueId)
    if (i.assignedBidId) throw new Error('This job has already been awarded.')
    if (this.db.bids.some((b) => b.issueId === issueId && b.contractorId === me.id && b.status === 'pending'))
      throw new Error('You already have a pending bid on this job.')
    const b: Bid = {
      id: uid('b_'),
      issueId,
      contractorId: me.id,
      amount: input.amount,
      days: input.days,
      message: input.message,
      status: 'pending',
      createdAt: now(),
      decidedAt: null,
      decisionNote: null,
      authorization: null,
      ai: input.ai,
    }
    this.db.bids.unshift(b)
    this.db.profiles
      .filter((p) => p.role === 'admin')
      .forEach((a) => this.notify(a.id, 'status', `New bid on ${ticketRef(i.ref)}`, `${me.company ?? me.name} · ${fmtMoney(b.amount)} · ${b.days} days`, '/admin?tab=bids'))
    this.save()
    return clone(b)
  }

  async withdrawBid(bidId: string) {
    await latency()
    const me = this.requireRole('contractor')
    const b = this.db.bids.find((x) => x.id === bidId && x.contractorId === me.id)
    if (!b || b.status !== 'pending') throw new Error('Only pending bids can be withdrawn.')
    b.status = 'withdrawn'
    this.save()
    return clone(b)
  }

  async decideBid(bidId: string, approve: boolean, note: string) {
    await latency()
    this.requireRole('admin')
    const b = this.db.bids.find((x) => x.id === bidId)
    if (!b) throw new Error('Bid not found')
    const i = this.issueOrThrow(b.issueId)
    b.status = approve ? 'approved' : 'rejected'
    b.decidedAt = now()
    b.decisionNote = note || null
    if (approve) {
      b.authorization = `WA-${ticketRef(i.ref).slice(3)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
      i.assignedBidId = b.id
      // Close competing bids
      this.db.bids
        .filter((o) => o.issueId === i.id && o.id !== b.id && o.status === 'pending')
        .forEach((o) => {
          o.status = 'rejected'
          o.decidedAt = now()
          o.decisionNote = 'Another bid was selected.'
          this.notify(o.contractorId, 'bid_rejected', `Bid not selected · ${ticketRef(i.ref)}`, 'Another contractor was awarded this job.', '/contractor')
        })
      this.setStatus(i, 'assigned', `Work authorised for ${this.db.profiles.find((p) => p.id === b.contractorId)?.company ?? 'contractor'}.`)
      this.notify(
        b.contractorId,
        'bid_approved',
        `Work authorised · ${ticketRef(i.ref)}`,
        `Your bid of ${fmtMoney(b.amount)} was approved. Authorisation ${b.authorization}. You may begin physical work.`,
        '/contractor?tab=orders',
      )
    } else {
      this.notify(b.contractorId, 'bid_rejected', `Bid declined · ${ticketRef(i.ref)}`, note || 'The municipal desk declined this bid.', '/contractor?tab=bids')
    }
    this.save()
    return clone(b)
  }

  async startWork(issueId: string, note: string) {
    await latency()
    const me = this.requireRole('contractor', 'admin')
    const i = this.issueOrThrow(issueId)
    const b = this.db.bids.find((x) => x.id === i.assignedBidId)
    if (me.role === 'contractor' && b?.contractorId !== me.id) throw new Error('You are not authorised on this job.')
    this.setStatus(i, 'in_progress', note || 'Crew on site.')
    this.save()
    return this.view(i)
  }

  // ───────── stories ─────────
  async listStories() {
    await latency()
    return clone(this.db.stories).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  async getStory(id: string) {
    await latency()
    return clone(this.db.stories.find((s) => s.id === id) ?? null)
  }

  // ───────── notifications ─────────
  async listNotifications() {
    await latency()
    if (!this.viewer) return []
    return clone(this.db.notifications.filter((n) => n.userId === this.viewer))
  }
  async markNotificationsRead() {
    this.db.notifications.forEach((n) => {
      if (n.userId === this.viewer) n.read = true
    })
    this.save()
  }
}
