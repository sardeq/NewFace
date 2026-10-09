// Supabase Edge Function: ai-screen
// Server-side Gemma (OpenRouter) screening — keeps the API key secret and makes AI decisions authoritative.
//
//   supabase secrets set OPENROUTER_API_KEY=sk-or-...  [OPENROUTER_MODEL=google/gemma-4-26b-a4b-it]
//   supabase functions deploy ai-screen
//
// Body shapes:
//   { kind: 'issue', input: {...} }  → preview assessment for the report form (no DB writes)
//   { kind: 'issue', issueId }       → screen a stored report and APPLY the outcome (verify / reject / queue)
//   { kind: 'bid',   bidId }         → score a stored bid and save the assessment for the admin
//   { kind: 'bid' | 'cost', input }  → stateless assessment (admin tools)
//
// Keep prompts in sync with src/lib/ai.ts.

import { createClient } from 'npm:@supabase/supabase-js@2'

const APP = 'Mend'
const CITY = 'Amman'
const CUR = 'JOD'
const MODEL = Deno.env.get('OPENROUTER_MODEL') ?? 'google/gemma-4-26b-a4b-it'
const KEY = Deno.env.get('OPENROUTER_API_KEY') ?? ''
const AUTO_ACCEPT = 0.8
const AUTO_REJECT = 0.9
const CATEGORIES = ['roads', 'lighting', 'water', 'sidewalks', 'signage', 'drainage', 'parks', 'other']

const COST_GUIDE = `Typical ${CITY} repair costs in ${CUR}:
roads (pothole patch) 150–900, roads (resurfacing a stretch) 2000–15000,
lighting (lamp/fixture) 120–600, lighting (pole replacement) 800–2500,
water (pipe leak) 300–2500, sidewalks (slab/curb) 400–4000, signage 80–500,
drainage (blocked inlet) 250–3000, parks (playground part) 300–5000.`

const ISSUE_SYSTEM = `You are the intake screener for ${APP}, a civic platform in ${CITY}
where citizens report damaged PUBLIC infrastructure so the municipality can fix it and
neighbours can crowdfund repairs.
Decide whether the report is a genuine, actionable public-infrastructure problem.
ACCEPT: damage to public roads, lighting, water/sewer pipes, sidewalks, stairs, signage, drainage, parks, public furniture.
REJECT: spam, ads, jokes, personal disputes, complaints about people, private property repairs,
noise/behaviour complaints, photos clearly unrelated to the text, offensive content.
REVIEW: plausible but vague, missing detail, or you are unsure.
${COST_GUIDE}
Respond with ONLY a JSON object:
{"verdict":"accept|reject|review","confidence":0..1,"category":one of ${JSON.stringify(CATEGORIES)},
"severity":1..5,"title":"max 70 chars","summary":"one sentence","cost_range":[min,max],"reasons":["..."]}`

const BID_SYSTEM = `You review contractor bids to repair public infrastructure for ${APP} (${CITY}).
Judge price vs. the official estimate, timeline realism for the severity, clarity of the method
statement, and contractor track record. Overpriced (>40% above estimate), vague or unverified bids
should not be accepted. ${COST_GUIDE}
Respond with ONLY JSON: {"verdict":"accept|reject|review","confidence":0..1,"score":0..100,"reasons":["..."]}`

const COST_SYSTEM = `You approve fundraising campaigns for ${APP} (${CITY}). A municipal admin attached an
official repair-cost estimate to a verified issue. Decide if the amount is reasonable to crowdfund.
${COST_GUIDE}
Respond with ONLY JSON: {"verdict":"accept|reject|review","confidence":0..1,"reasons":["..."]}`

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// deno-lint-ignore no-explicit-any
type Json = Record<string, any>

async function gemma(system: string, user: string | Json[]): Promise<Json> {
  const body = (json: boolean) =>
    JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 600,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    })
  const send = (json: boolean) =>
    fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'X-Title': APP },
      body: body(json),
    })
  let res = await send(true)
  if (res.status === 400) res = await send(false)
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`)
  const j = await res.json()
  const text: string = j.choices?.[0]?.message?.content ?? ''
  const s = text.replace(/```(?:json)?/gi, '')
  return JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1))
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number(n) || 0))
const verdict = (v: unknown) => (v === 'accept' || v === 'reject' ? v : 'review')
const reasons = (v: unknown) => (Array.isArray(v) ? v : [v]).filter((x) => typeof x === 'string').slice(0, 3)

function normIssue(r: Json, description: string) {
  const range = Array.isArray(r.cost_range) ? r.cost_range.map(Number) : [0, 0]
  return {
    verdict: verdict(r.verdict),
    confidence: clamp(r.confidence, 0, 1),
    category: CATEGORIES.includes(r.category) ? r.category : 'other',
    severity: clamp(Math.round(r.severity), 1, 5),
    title: String(r.title || description.slice(0, 64)).slice(0, 110),
    summary: String(r.summary || description),
    costRange: [Math.round(Math.min(...range)), Math.round(Math.max(...range))],
    reasons: reasons(r.reasons),
    model: MODEL,
    source: 'gemma',
    at: new Date().toISOString(),
  }
}

async function screenIssue(i: { description: string; photo?: string; address?: string; district?: string }) {
  const content: Json[] = [
    {
      type: 'text',
      text: `Location: ${i.address ?? 'unknown'} (${i.district ?? 'unknown district'})\nCitizen description: """${i.description}"""\n${i.photo ? 'The attached photo was taken by the citizen at the location.' : 'No photo attached.'}`,
    },
  ]
  if (i.photo) content.push({ type: 'image_url', image_url: { url: i.photo } })
  return normIssue(await gemma(ISSUE_SYSTEM, content), i.description)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const reply = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    if (!KEY) return reply({ error: 'OPENROUTER_API_KEY secret is not set' }, 500)
    const { kind, input, issueId, bidId } = await req.json()

    // Caller identity (RLS-scoped) + service client for authoritative writes.
    const url = Deno.env.get('SUPABASE_URL')!
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: auth } = await asUser.auth.getUser()
    if (!auth.user) return reply({ error: 'Not signed in' }, 401)

    if (kind === 'issue' && issueId) {
      const { data: issue } = await admin.from('issues').select('*').eq('id', issueId).single()
      if (!issue || issue.author_id !== auth.user.id) return reply({ error: 'Not your report' }, 403)
      const a = await screenIssue({ description: issue.description, photo: issue.photos?.[0], address: issue.address, district: issue.district })
      const accept = a.verdict === 'accept' && a.confidence >= AUTO_ACCEPT
      const reject = a.verdict === 'reject' && a.confidence >= AUTO_REJECT
      await admin
        .from('issues')
        .update({
          ai: a,
          title: a.title,
          category: a.category,
          severity: a.severity,
          verified_by: accept ? 'ai' : null,
          status: reject ? 'rejected' : 'pending_review',
          rejection_reason: reject ? a.reasons[0] ?? 'Not an infrastructure issue.' : null,
        })
        .eq('id', issueId)
      await admin.from('status_events').insert({
        issue_id: issueId,
        status: reject ? 'rejected' : 'pending_review',
        note: accept
          ? `Auto-verified by Gemma (${Math.round(a.confidence * 100)}% confidence). Waiting for a cost estimate.`
          : reject
            ? 'Screened out by Gemma. The author can appeal.'
            : 'Gemma was unsure — queued for a human reviewer.',
      })
      return reply(a)
    }

    if (kind === 'issue') return reply(await screenIssue(input))

    if (kind === 'bid') {
      let payload = input
      if (bidId) {
        const { data: bid } = await admin.from('bids').select('*, issues(*), profiles!bids_contractor_id_fkey(*)').eq('id', bidId).single()
        if (!bid || bid.contractor_id !== auth.user.id) return reply({ error: 'Not your bid' }, 403)
        const { count } = await admin.from('stories').select('id', { count: 'exact', head: true }).eq('contractor_id', bid.contractor_id)
        payload = {
          issue: { title: bid.issues.title, category: bid.issues.category, severity: bid.issues.severity, estimatedCost: bid.issues.estimated_cost, ai: bid.issues.ai },
          bid: { amount: bid.amount, days: bid.days, message: bid.message },
          contractor: { company: bid.profiles?.company, verified: bid.profiles?.verified, completedJobs: count ?? 0 },
        }
      }
      const r = await gemma(BID_SYSTEM, JSON.stringify(payload))
      const a = {
        verdict: verdict(r.verdict),
        confidence: clamp(r.confidence, 0, 1),
        score: clamp(Math.round(r.score), 0, 100),
        reasons: reasons(r.reasons),
        model: MODEL,
        source: 'gemma',
        at: new Date().toISOString(),
      }
      if (bidId) await admin.from('bids').update({ ai: a }).eq('id', bidId)
      return reply(a)
    }

    if (kind === 'cost') {
      const r = await gemma(COST_SYSTEM, JSON.stringify(input))
      return reply({ verdict: verdict(r.verdict), confidence: clamp(r.confidence, 0, 1), reasons: reasons(r.reasons), model: MODEL, source: 'gemma', at: new Date().toISOString() })
    }

    return reply({ error: 'Unknown kind' }, 400)
  } catch (e) {
    return reply({ error: (e as Error).message }, 500)
  }
})
