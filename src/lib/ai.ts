/**
 * Gemma (via OpenRouter) screening for the three request types the platform has to accept or refuse:
 *   1. Citizen issue reports           → screenIssue()
 *   2. Fundraising requests (cost set) → screenCost()
 *   3. Contractor repair bids          → screenBid()
 *
 * Every call goes through the Supabase Edge Function `ai-screen`, which holds the OpenRouter key and
 * the prompts (supabase/functions/ai-screen/index.ts). If the function is unreachable, offline rules
 * keep the UI usable and mark the result `source: 'heuristic'`.
 */
import { AI_THRESHOLDS, APP, OPENROUTER_MODEL } from '../config'
import { supabase } from './supabase'
import { CATEGORIES } from './format'
import type {
  AiVerdict,
  BidAssessment,
  Category,
  CostAssessment,
  Issue,
  IssueAssessment,
  Profile,
} from '../types'

// ───────────────────────────── transport ─────────────────────────────

export class AiError extends Error {}

async function callEdge(kind: 'issue' | 'bid' | 'cost', input: unknown): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('ai-screen', { body: { kind, input } })
  if (error) {
    // The function replies { error: "..." } — surface that instead of the generic "non-2xx status code".
    let detail = error.message
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = (await ctx.clone().json()) as { error?: string }
        if (body?.error) detail = body.error
      } catch {
        /* not JSON */
      }
    }
    throw new AiError(`ai-screen: ${detail}`)
  }
  return data
}

// ───────────────────────────── normalisers ─────────────────────────────

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const asVerdict = (v: unknown): AiVerdict => (v === 'accept' || v === 'reject' ? v : 'review')
const asNum = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || d)
const asReasons = (v: unknown) =>
  (Array.isArray(v) ? v : [v]).filter((x): x is string => typeof x === 'string' && x.length > 0).slice(0, 3)

function normIssue(raw: unknown, description: string): IssueAssessment {
  const r = (raw ?? {}) as Record<string, unknown>
  const cat = CATEGORIES.includes(r.category as Category) ? (r.category as Category) : 'other'
  const range = Array.isArray(r.cost_range) ? r.cost_range.map((n) => asNum(n, 0)) : [0, 0]
  const lo = Math.max(0, Math.min(range[0] ?? 0, range[1] ?? 0))
  const hi = Math.max(range[0] ?? 0, range[1] ?? 0)
  return {
    verdict: asVerdict(r.verdict),
    confidence: clamp(asNum(r.confidence, 0.5), 0, 1),
    category: cat,
    severity: clamp(Math.round(asNum(r.severity, 3)), 1, 5),
    title: (typeof r.title === 'string' && r.title.trim()) || description.slice(0, 64),
    summary: (typeof r.summary === 'string' && r.summary.trim()) || description,
    costRange: [Math.round(lo), Math.round(hi || lo)],
    reasons: asReasons(r.reasons),
    model: OPENROUTER_MODEL,
    source: 'gemma',
    at: new Date().toISOString(),
  }
}

// ───────────────────────────── heuristics (offline) ─────────────────────────────

const KEYWORDS: Record<Category, RegExp> = {
  roads: /pothole|asphalt|road|street|crack|lane|tarmac|speed ?bump|حفر|شارع/i,
  lighting: /light|lamp|bulb|dark|pole|إنارة|ضوء/i,
  water: /pipe|leak|water|burst|sewer|valve|hydrant|مياه|تسريب/i,
  sidewalks: /sidewalk|pavement|curb|kerb|stair|step|tile|رصيف|درج/i,
  signage: /sign|signal|traffic light|crossing|zebra|إشارة/i,
  drainage: /drain|flood|gutter|manhole|grate|puddle|مجاري|تصريف/i,
  parks: /park|playground|swing|slide|bench|tree|garden|حديقة/i,
  other: /$^/,
}
const RANGES: Record<Category, [number, number]> = {
  roads: [150, 900],
  lighting: [120, 600],
  water: [300, 2500],
  sidewalks: [400, 4000],
  signage: [80, 500],
  drainage: [250, 3000],
  parks: [300, 5000],
  other: [100, 1500],
}
const SPAM = /buy now|discount|promo|follow me|subscribe|http|www\.|crypto|my neighbou?r is|idiot|stupid/i
const DANGER = /danger|child|kids|school|fell|injur|accident|deep|night|exposed wire|electric|flood/i

function heuristicIssue(description: string, hasPhoto: boolean): IssueAssessment {
  const d = description.trim()
  const hit = (CATEGORIES.filter((c) => c !== 'other') as Category[]).find((c) => KEYWORDS[c].test(d))
  const category: Category = hit ?? 'other'
  const spam = SPAM.test(d)
  const severity = clamp(2 + (DANGER.test(d) ? 2 : 0) + (d.length > 140 ? 1 : 0), 1, 5)
  let verdict: AiVerdict = 'review'
  let confidence = 0.55
  const reasons: string[] = []
  if (spam) {
    verdict = 'reject'
    confidence = 0.93
    reasons.push('Text reads like promotion or a personal complaint, not infrastructure damage.')
  } else if (hit && d.length >= 20 && hasPhoto) {
    verdict = 'accept'
    confidence = 0.84
    reasons.push(`Describes ${category} damage in a public space.`, 'Photo evidence attached.')
  } else {
    if (!hit) reasons.push('Could not tell which public asset is damaged.')
    if (d.length < 20) reasons.push('Description is very short.')
    if (!hasPhoto) reasons.push('No photo attached.')
  }
  const first = d.split(/[.!?\n]/)[0]?.trim() ?? d
  return {
    verdict,
    confidence,
    category,
    severity,
    title: first.length > 68 ? `${first.slice(0, 66)}…` : first || 'Untitled report',
    summary: d.length > 160 ? `${d.slice(0, 158)}…` : d,
    costRange: RANGES[category],
    reasons,
    model: 'rules-v1',
    source: 'heuristic',
    at: new Date().toISOString(),
  }
}

// ───────────────────────────── public API ─────────────────────────────

export interface IssueScreenInput {
  description: string
  photo?: string // data URL or https URL
  address?: string
  district?: string
}

export async function screenIssue(input: IssueScreenInput): Promise<IssueAssessment> {
  try {
    return normIssue(await callEdge('issue', input), input.description)
  } catch (e) {
    console.warn('[ai] issue screening failed, using rules fallback', e)
    const h = heuristicIssue(input.description, Boolean(input.photo))
    return { ...h, reasons: [...h.reasons, 'Gemma was unreachable — screened by fallback rules.'].slice(0, 3) }
  }
}

export interface BidScreenInput {
  issue: Pick<Issue, 'title' | 'category' | 'severity' | 'estimatedCost' | 'ai'>
  bid: { amount: number; days: number; message: string }
  contractor: Pick<Profile, 'company' | 'verified'> & { completedJobs: number }
}

export async function screenBid(input: BidScreenInput): Promise<BidAssessment> {
  try {
    const raw = (await callEdge('bid', input)) as Record<string, unknown>
    return {
      model: OPENROUTER_MODEL,
      source: 'gemma',
      at: new Date().toISOString(),
      verdict: asVerdict(raw.verdict),
      confidence: clamp(asNum(raw.confidence, 0.5), 0, 1),
      score: clamp(Math.round(asNum(raw.score, 50)), 0, 100),
      reasons: asReasons(raw.reasons),
    }
  } catch (e) {
    console.warn('[ai] bid screening failed, using rules fallback', e)
  }

  // rules fallback
  const est = input.issue.estimatedCost ?? input.issue.ai?.costRange[1] ?? input.bid.amount
  const ratio = input.bid.amount / Math.max(1, est)
  const reasons: string[] = []
  let score = 70
  if (ratio > 1.4) {
    score -= 35
    reasons.push(`Price is ${Math.round((ratio - 1) * 100)}% above the official estimate.`)
  }
  else if (ratio < 0.5) {
    score -= 20
    reasons.push('Price is unusually low — risk of corner-cutting.')
  }
  else {
    score += 10
    reasons.push('Price is in line with the official estimate.')
  }
  if (input.bid.message.trim().length < 40) {
    score -= 15
    reasons.push('Method statement is thin.')
  }
  if (!input.contractor.verified) {
    score -= 15
    reasons.push('Contractor is not yet verified.')
  }
  else if (input.contractor.completedJobs > 3) {
    score += 10
    reasons.push(`${input.contractor.completedJobs} jobs completed on ${APP.name}.`)
  }
  if (input.issue.severity >= 4 && input.bid.days > 14) {
    score -= 10
    reasons.push('Timeline is long for an urgent issue.')
  }
  score = clamp(score, 0, 100)
  return {
    model: 'rules-v1',
    source: 'heuristic',
    at: new Date().toISOString(),
    verdict: score >= 70 ? 'accept' : score < 40 ? 'reject' : 'review',
    confidence: clamp(0.55 + Math.abs(score - 55) / 100, 0, 0.95),
    score,
    reasons: reasons.slice(0, 3),
  }
}

export interface CostScreenInput {
  issue: Pick<Issue, 'title' | 'description' | 'category' | 'severity' | 'ai'>
  estimatedCost: number
}

export async function screenCost(input: CostScreenInput): Promise<CostAssessment> {
  try {
    const raw = (await callEdge('cost', input)) as Record<string, unknown>
    return {
      verdict: asVerdict(raw.verdict),
      confidence: clamp(asNum(raw.confidence, 0.5), 0, 1),
      reasons: asReasons(raw.reasons),
      model: OPENROUTER_MODEL,
      source: 'gemma',
      at: new Date().toISOString(),
    }
  } catch (e) {
    console.warn('[ai] cost screening failed, using rules fallback', e)
  }

  const [lo, hi] = input.issue.ai?.costRange ?? RANGES[input.issue.category]
  const tol = AI_THRESHOLDS.costTolerance
  const c = input.estimatedCost
  const inRange = c >= lo * (1 - tol) && c <= hi * (1 + tol)
  const far = c > hi * 2 || c < lo * 0.3
  return {
    verdict: inRange ? 'accept' : far ? 'reject' : 'review',
    confidence: inRange ? 0.86 : far ? 0.9 : 0.6,
    reasons: [
      inRange
        ? `Estimate sits within the expected ${APP.currency} ${lo}–${hi} range.`
        : `Estimate is outside the expected ${APP.currency} ${lo}–${hi} range for this kind of repair.`,
    ],
    model: 'rules-v1',
    source: 'heuristic',
    at: new Date().toISOString(),
  }
}

// ───────────────────────────── decisions ─────────────────────────────

export type IntakeOutcome = 'published' | 'queued' | 'rejected'

/** What happens to a report right after screening. Admins can override any of these. */
export function intakeOutcome(a: IssueAssessment): IntakeOutcome {
  if (a.verdict === 'accept' && a.confidence >= AI_THRESHOLDS.autoAccept) return 'published'
  if (a.verdict === 'reject' && a.confidence >= AI_THRESHOLDS.autoReject) return 'rejected'
  return 'queued'
}

/** Fundraising campaign opens automatically only when Gemma agrees with the estimate. */
export const costAutoApproved = (c: CostAssessment) =>
  c.verdict === 'accept' && c.confidence >= AI_THRESHOLDS.autoAccept

export const aiModeLabel = () => 'Gemma · edge function'
