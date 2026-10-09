import type { Api } from './api'
import type {
  AdminIssuePatch,
  AppNotification,
  Bid,
  BidStatus,
  Comment,
  Donation,
  FeedQuery,
  Issue,
  NewIssueInput,
  Profile,
  StatusEvent,
  Story,
} from '../types'
import { requireSupabase } from '../lib/supabase'
import { dataUrlToBlob } from '../lib/media'
import { distanceKm, hotScore, pct } from '../lib/format'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

const toProfile = (r: Row): Profile => ({
  id: r.id,
  name: r.name,
  handle: r.handle ?? '',
  role: r.role,
  district: r.district ?? '',
  hue: r.hue ?? 20,
  company: r.company ?? undefined,
  verified: r.verified ?? false,
  joinedAt: r.joined_at,
})

const toIssue = (r: Row, myVote: -1 | 0 | 1 = 0): Issue => ({
  id: r.id,
  ref: Number(r.ref),
  authorId: r.author_id,
  title: r.title,
  description: r.description,
  category: r.category,
  severity: r.severity,
  status: r.status,
  location: { lat: r.lat, lng: r.lng, accuracy: r.accuracy ?? undefined },
  address: r.address,
  district: r.district,
  photos: r.photos ?? [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  upvotes: r.upvotes,
  downvotes: r.downvotes,
  commentCount: r.comment_count,
  estimatedCost: r.estimated_cost === null ? null : Number(r.estimated_cost),
  raised: Number(r.raised ?? 0),
  donorCount: r.donor_count ?? 0,
  ai: r.ai,
  costCheck: r.cost_check,
  assignedBidId: r.assigned_bid_id,
  storyId: r.story_id,
  verifiedBy: r.verified_by,
  rejectionReason: r.rejection_reason,
  myVote,
})

const toBid = (r: Row): Bid => ({
  id: r.id,
  issueId: r.issue_id,
  contractorId: r.contractor_id,
  amount: Number(r.amount),
  days: r.days,
  message: r.message,
  status: r.status,
  createdAt: r.created_at,
  decidedAt: r.decided_at,
  decisionNote: r.decision_note,
  authorization: r.authorization,
  ai: r.ai,
})

const toDonation = (r: Row): Donation => ({
  id: r.id,
  issueId: r.issue_id,
  userId: r.user_id ?? 'anonymous',
  amount: Number(r.amount),
  anonymous: r.anonymous,
  method: r.method,
  reference: r.reference,
  createdAt: r.created_at,
})

const toStory = (r: Row): Story => ({
  id: r.id,
  issueId: r.issue_id,
  afterPhotos: r.after_photos ?? [],
  summary: r.summary,
  finalCost: Number(r.final_cost),
  daysToFix: r.days_to_fix,
  contractorId: r.contractor_id,
  createdAt: r.created_at,
})

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

export class SupabaseApi implements Api {
  readonly mode = 'supabase' as const
  private viewer: string | null = null
  private get sb() {
    return requireSupabase()
  }

  setViewer(id: string | null) {
    this.viewer = id
  }

  private async myVotes(ids: string[]) {
    if (!this.viewer || ids.length === 0) return new Map<string, -1 | 1>()
    const rows = must(await this.sb.from('votes').select('issue_id,value').in('issue_id', ids))
    return new Map((rows as Row[]).map((r) => [r.issue_id as string, r.value as -1 | 1]))
  }

  async listProfiles() {
    return (must(await this.sb.from('profiles').select('*').order('name')) as Row[]).map(toProfile)
  }
  async getProfile(id: string) {
    const r = must(await this.sb.from('profiles').select('*').eq('id', id).maybeSingle())
    return r ? toProfile(r as Row) : null
  }
  async contractorJobsDone(id: string) {
    const { count } = await this.sb.from('stories').select('id', { count: 'exact', head: true }).eq('contractor_id', id)
    return count ?? 0
  }

  async listIssues(q: FeedQuery) {
    let query = this.sb.from('issues').select('*').limit(200)
    if (q.authorId) query = query.eq('author_id', q.authorId)
    else query = query.not('verified_by', 'is', null).neq('status', 'rejected')
    if (q.status === 'active') query = query.not('status', 'in', '(resolved,rejected)')
    else if (q.status && q.status !== 'all') query = query.eq('status', q.status)
    if (q.category && q.category !== 'all') query = query.eq('category', q.category)
    if (q.sort === 'funding') query = query.eq('status', 'open_for_funding')
    query = query.order('created_at', { ascending: false })
    const rows = must(await query) as Row[]
    const votes = await this.myVotes(rows.map((r) => r.id))
    const list = rows.map((r) => toIssue(r, votes.get(r.id) ?? 0))
    switch (q.sort) {
      case 'top':
        return list.sort((a, b) => b.upvotes - b.downvotes - (a.upvotes - a.downvotes))
      case 'near':
        return q.near ? list.sort((a, b) => distanceKm(q.near!, a.location) - distanceKm(q.near!, b.location)) : list
      case 'funding':
        return list.sort((a, b) => pct(b.raised, b.estimatedCost) - pct(a.raised, a.estimatedCost))
      case 'new':
        return list
      default:
        return list.sort((a, b) => hotScore(b) - hotScore(a))
    }
  }

  async getIssue(id: string) {
    const r = must(await this.sb.from('issues').select('*').eq('id', id).maybeSingle()) as Row | null
    if (!r) return null
    const votes = await this.myVotes([id])
    return toIssue(r, votes.get(id) ?? 0)
  }

  async uploadPhoto(dataUrl: string, folder: 'reports' | 'after') {
    if (!dataUrl.startsWith('data:')) return dataUrl
    if (!this.viewer) throw new Error('Sign in first')
    const path = `${this.viewer}/${folder}/${crypto.randomUUID()}.jpg`
    must(await this.sb.storage.from('issue-media').upload(path, dataUrlToBlob(dataUrl), { contentType: 'image/jpeg' }))
    return this.sb.storage.from('issue-media').getPublicUrl(path).data.publicUrl
  }

  async createIssue(input: NewIssueInput) {
    if (!this.viewer) throw new Error('Sign in to report')
    const photos = await Promise.all(input.photos.map((p) => this.uploadPhoto(p, 'reports')))
    const row = must(
      await this.sb
        .from('issues')
        .insert({
          author_id: this.viewer,
          title: input.ai.title,
          description: input.description,
          category: input.ai.category,
          severity: input.ai.severity,
          lat: input.location.lat,
          lng: input.location.lng,
          accuracy: input.location.accuracy ?? null,
          address: input.address,
          district: input.district,
          photos,
          ai: input.ai, // advisory copy; the edge function re-screens and decides
        })
        .select('*')
        .single(),
    ) as Row
    // Server-side authoritative screening (sets verified_by / rejected).
    await this.sb.functions.invoke('ai-screen', { body: { kind: 'issue', issueId: row.id } }).catch(() => null)
    return (await this.getIssue(row.id)) ?? toIssue(row, 1)
  }

  async vote(issueId: string, value: -1 | 0 | 1) {
    must(await this.sb.rpc('cast_vote', { p_issue: issueId, p_value: value }))
    return (await this.getIssue(issueId))!
  }

  async listEvents(issueId: string) {
    const rows = must(await this.sb.from('status_events').select('*').eq('issue_id', issueId).order('at')) as Row[]
    return rows.map(
      (r): StatusEvent => ({ id: r.id, issueId: r.issue_id, status: r.status, note: r.note, actorId: r.actor_id, at: r.at }),
    )
  }

  async stats() {
    return must(await this.sb.rpc('city_stats')) as Awaited<ReturnType<Api['stats']>>
  }

  async listComments(issueId: string) {
    const rows = must(await this.sb.from('comments').select('*').eq('issue_id', issueId).order('created_at')) as Row[]
    return rows.map((r): Comment => ({ id: r.id, issueId: r.issue_id, authorId: r.author_id, body: r.body, createdAt: r.created_at }))
  }
  async addComment(issueId: string, body: string) {
    const r = must(
      await this.sb.from('comments').insert({ issue_id: issueId, author_id: this.viewer, body: body.trim() }).select('*').single(),
    ) as Row
    return { id: r.id, issueId: r.issue_id, authorId: r.author_id, body: r.body, createdAt: r.created_at }
  }
  async shareInternal(issueId: string, toUserId: string, note: string) {
    must(await this.sb.rpc('share_issue', { p_issue: issueId, p_to: toUserId, p_note: note }))
  }

  async donate(issueId: string, amount: number, opts: { anonymous: boolean; method: string }) {
    const r = must(
      await this.sb.rpc('donate', { p_issue: issueId, p_amount: amount, p_anonymous: opts.anonymous, p_method: opts.method }),
    ) as Row
    return toDonation(r)
  }
  async listDonations(f: { issueId?: string; userId?: string }) {
    // Own history comes from the private table; per-issue ledger from the anonymised view.
    let q = f.userId ? this.sb.from('donations').select('*') : this.sb.from('donation_ledger').select('*')
    if (f.issueId) q = q.eq('issue_id', f.issueId)
    if (f.userId) q = q.eq('user_id', f.userId)
    const rows = must(await q.order('created_at', { ascending: false })) as Row[]
    return rows.map(toDonation)
  }

  async listQueue() {
    const rows = must(await this.sb.from('issues').select('*').order('created_at', { ascending: false }).limit(300)) as Row[]
    return rows.map((r) => toIssue(r))
  }

  async updateIssue(id: string, patch: AdminIssuePatch) {
    const { note, ...rest } = patch
    const r = must(await this.sb.rpc('admin_update_issue', { p_issue: id, p_patch: rest, p_note: note ?? '' })) as Row
    return toIssue(r)
  }

  async resolveIssue(issueId: string, input: { afterPhotos: string[]; summary: string; finalCost: number }) {
    const photos = await Promise.all(input.afterPhotos.map((p) => this.uploadPhoto(p, 'after')))
    const r = must(
      await this.sb.rpc('resolve_issue', {
        p_issue: issueId,
        p_after: photos,
        p_summary: input.summary,
        p_final_cost: input.finalCost,
      }),
    ) as Row
    return toStory(r)
  }

  async listBids(f: { issueId?: string; contractorId?: string; status?: BidStatus }) {
    let q = this.sb.from('bids').select('*')
    if (f.issueId) q = q.eq('issue_id', f.issueId)
    if (f.contractorId) q = q.eq('contractor_id', f.contractorId)
    if (f.status) q = q.eq('status', f.status)
    return (must(await q.order('created_at', { ascending: false })) as Row[]).map(toBid)
  }

  async submitBid(issueId: string, input: { amount: number; days: number; message: string }) {
    const r = must(
      await this.sb
        .from('bids')
        .insert({ issue_id: issueId, contractor_id: this.viewer, amount: input.amount, days: input.days, message: input.message })
        .select('*')
        .single(),
    ) as Row
    // Gemma scores the bid server-side for the admin.
    await this.sb.functions.invoke('ai-screen', { body: { kind: 'bid', bidId: r.id } }).catch(() => null)
    const fresh = must(await this.sb.from('bids').select('*').eq('id', r.id).single()) as Row
    return toBid(fresh)
  }

  async withdrawBid(bidId: string) {
    return toBid(must(await this.sb.rpc('withdraw_bid', { p_bid: bidId })) as Row)
  }
  async decideBid(bidId: string, approve: boolean, note: string) {
    return toBid(must(await this.sb.rpc('decide_bid', { p_bid: bidId, p_approve: approve, p_note: note })) as Row)
  }
  async startWork(issueId: string, note: string) {
    return toIssue(must(await this.sb.rpc('start_work', { p_issue: issueId, p_note: note })) as Row)
  }

  async listStories() {
    return (must(await this.sb.from('stories').select('*').order('created_at', { ascending: false })) as Row[]).map(toStory)
  }
  async getStory(id: string) {
    const r = must(await this.sb.from('stories').select('*').eq('id', id).maybeSingle()) as Row | null
    return r ? toStory(r) : null
  }

  async listNotifications() {
    if (!this.viewer) return []
    const rows = must(
      await this.sb.from('notifications').select('*').eq('user_id', this.viewer).order('at', { ascending: false }).limit(50),
    ) as Row[]
    return rows.map(
      (r): AppNotification => ({ id: r.id, userId: r.user_id, kind: r.kind, title: r.title, body: r.body, link: r.link, read: r.read, at: r.at }),
    )
  }
  async markNotificationsRead() {
    if (!this.viewer) return
    must(await this.sb.from('notifications').update({ read: true }).eq('user_id', this.viewer).eq('read', false))
  }
}
