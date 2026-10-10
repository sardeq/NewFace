// Supabase Edge Function: ai-screen
// Server-side Gemma (OpenRouter) screening — keeps the API key secret and makes AI decisions authoritative.
//
//   supabase secrets set OPENROUTER_API_KEY=sk-or-...  [OPENROUTER_MODEL=google/gemma-4-26b-a4b-it:free]
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

const APP = 'Matab'
const CITY = 'Amman'
const CUR = 'JOD'
// Free on OpenRouter (no credits needed, daily request limit) and accepts images.
const MODEL = Deno.env.get('OPENROUTER_MODEL') ?? 'google/gemma-4-26b-a4b-it:free'
const KEY = Deno.env.get('OPENROUTER_API_KEY') ?? ''
// Used when MODEL is unknown, busy or rate-limited: OpenRouter's free router picks any free model that can
// handle the request (images included). Override with the OPENROUTER_FALLBACK_MODEL secret.
const FALLBACK_MODEL = Deno.env.get('OPENROUTER_FALLBACK_MODEL') ?? 'openrouter/free'
// At or above AUTO_ACCEPT Gemma's "accept" is final — no admin step:
//   reports → verified + fundraising opened at Gemma's cost estimate
//   bids    → awarded (verified contractors only)
// Below it, the item waits for a human. Keep in sync with AI_THRESHOLDS in src/config.ts.
const AUTO_ACCEPT = 0.7
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

/** Gemma's single funding goal from its cost range: the midpoint, rounded to 10. 0 if it gave no range. */
const goalFrom = (range: number[]) => {
  const [lo, hi] = range
  if (!(hi > 0)) return 0
  return Math.max(10, Math.round(((lo > 0 ? lo : hi) + hi) / 2 / 10) * 10)
}

/** Pull the first {...} object out of a model reply (tolerates ```json fences and chatter). */
function parseJson(text: string): Json | null {
  const s = text.replace(/```(?:json)?/gi, '')
  const a = s.indexOf('{')
  const b = s.lastIndexOf('}')
  if (a < 0 || b <= a) return null
  try {
    return JSON.parse(s.slice(a, b + 1))
  } catch {
    return null
  }
}

/** Free OpenRouter models that accept images — discovered from the live model list, cached per instance. */
let freeVisionCache: string[] | null = null
async function freeVisionModels(): Promise<string[]> {
  if (freeVisionCache) return freeVisionCache
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models')
    const { data } = (await res.json()) as { data: Json[] }
    freeVisionCache = data
      .filter((m) => String(m.id).endsWith(':free'))
      .filter((m) => (m.architecture?.input_modalities ?? []).includes('image'))
      .filter((m) => (m.architecture?.output_modalities ?? ['text']).includes('text'))
      .map((m) => String(m.id))
  } catch (e) {
    console.error('could not list OpenRouter models', e)
    freeVisionCache = []
  }
  return freeVisionCache
}

/** Text of a reply. Reasoning models sometimes leave `content` empty and put everything in `reasoning`. */
const replyText = (j: Json): string => {
  const m = j.choices?.[0]?.message ?? {}
  const c = typeof m.content === 'string' ? m.content : Array.isArray(m.content) ? m.content.map((p: Json) => p.text ?? '').join('') : ''
  return c.trim() || String(m.reasoning ?? '').trim()
}

/**
 * Ask Gemma for a JSON verdict. Tries the configured model, the fallback, then up to 3 other free
 * vision models from OpenRouter's live list. Per model: JSON mode first, then plain; with the photo,
 * then text-only if the model refuses images. Throws one error listing what each model said.
 */
async function gemma(system: string, user: string | Json[]): Promise<Json> {
  const textOnly = Array.isArray(user) ? user.filter((c) => c.type === 'text') : user
  const contents = Array.isArray(user) && textOnly.length !== user.length ? [user, textOnly] : [user]
  const tried: string[] = []
  const errors: string[] = []
  const fail = (model: string, why: string) => {
    errors.push(`${model}: ${why}`)
    console.error(`[gemma] ${model}: ${why}`)
  }

  const attempt = async (model: string): Promise<Json | null> => {
    tried.push(model)
    for (const content of contents) {
      for (const json of [true, false]) {
        let res: Response
        try {
          res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'X-Title': APP },
            body: JSON.stringify({
              model,
              temperature: 0.2,
              // Room for "thinking" models: with a small budget they spend it all reasoning and reply empty.
              max_tokens: 2000,
              messages: [
                { role: 'system', content: system },
                { role: 'user', content },
              ],
              ...(json ? { response_format: { type: 'json_object' } } : {}),
            }),
          })
        } catch (e) {
          fail(model, `network error ${(e as Error).message}`)
          return null
        }
        const raw = await res.text()
        if (!res.ok) {
          let msg = raw.slice(0, 160)
          try {
            msg = JSON.parse(raw).error?.message ?? msg
          } catch {
            /* keep raw */
          }
          if (res.status === 401) throw new Error(`OpenRouter rejected the API key (401): ${msg}`)
          fail(model, `HTTP ${res.status} ${msg}`)
          if (res.status === 400) continue // try plain mode / text-only
          return null // 402 / 404 / 429 / 5xx → next model
        }
        let j: Json
        try {
          j = JSON.parse(raw)
        } catch {
          fail(model, 'non-JSON HTTP response')
          continue
        }
        if (j.error) {
          fail(model, j.error.message ?? JSON.stringify(j.error))
          return null
        }
        const text = replyText(j)
        const parsed = parseJson(text)
        if (parsed) return parsed
        fail(model, text ? `not JSON: ${text.slice(0, 80)}` : `empty reply (finish: ${j.choices?.[0]?.finish_reason ?? '?'})`)
        if (json) continue // retry the same model without JSON mode
        return null
      }
    }
    return null
  }

  for (const model of [...new Set([MODEL, FALLBACK_MODEL])]) {
    const r = await attempt(model)
    if (r) return r
  }
  const extra = (await freeVisionModels()).filter((m) => !tried.includes(m)).slice(0, 3)
  for (const model of extra) {
    const r = await attempt(model)
    if (r) return r
  }
  const all = errors.join(' | ')
  const limited = /rate limit|per-day|429/i.test(all)
  throw new Error(
    (limited ? 'OpenRouter free-tier limit reached. ' : 'No model returned a usable answer. ') + all.slice(0, 700),
  )
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
  const photo = i.photo && /^(https?:|data:image\/)/.test(i.photo) ? i.photo : undefined
  const content: Json[] = [
    {
      type: 'text',
      text: `Location: ${i.address ?? 'unknown'} (${i.district ?? 'unknown district'})\nCitizen description: """${i.description}"""\n${photo ? 'The attached photo was taken by the citizen at the location.' : 'No photo attached.'}`,
    },
  ]
  // Only real images go to the model — `sketch:<kind>` placeholders are drawn by the UI.
  if (photo) content.push({ type: 'image_url', image_url: { url: photo } })
  return normIssue(await gemma(ISSUE_SYSTEM, content), i.description)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const reply = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    if (!KEY) {
      return reply({ error: 'OPENROUTER_API_KEY secret is not set — run: supabase secrets set OPENROUTER_API_KEY=sk-or-...' }, 500)
    }
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
      const reject = !accept && a.verdict === 'reject' && a.confidence >= AUTO_REJECT
      const goal = accept ? goalFrom(a.costRange) : 0
      const fund = goal > 0
      const pct = Math.round(a.confidence * 100)
      const costCheck = fund
        ? {
            verdict: 'accept',
            confidence: a.confidence,
            reasons: [`Goal set automatically from Gemma's ${CUR} ${a.costRange[0]}–${a.costRange[1]} estimate (${pct}% confidence).`],
            model: MODEL,
            source: 'gemma',
            at: new Date().toISOString(),
          }
        : null
      const status = reject ? 'rejected' : fund ? 'open_for_funding' : 'pending_review'
      const { error: upErr } = await admin
        .from('issues')
        .update({
          ai: a,
          title: a.title,
          category: a.category,
          severity: a.severity,
          verified_by: accept ? 'ai' : null,
          status,
          estimated_cost: fund ? goal : null,
          cost_check: costCheck,
          rejection_reason: reject ? a.reasons[0] ?? 'Not an infrastructure issue.' : null,
        })
        .eq('id', issueId)
      if (upErr) throw upErr

      const events: Json[] = [
        {
          issue_id: issueId,
          status: reject ? 'rejected' : 'pending_review',
          note: accept
            ? `Auto-verified by Gemma (${pct}% confidence).` + (fund ? '' : ' Waiting for a cost estimate.')
            : reject
              ? 'Screened out by Gemma. The author can appeal.'
              : `Gemma was unsure (${pct}% confidence) — queued for a human reviewer.`,
        },
      ]
      if (fund) events.push({ issue_id: issueId, status: 'open_for_funding', note: `Estimate ${CUR} ${goal} set by Gemma. Fundraising open.` })
      await admin.from('status_events').insert(events)
      if (fund || reject) {
        await admin.rpc('notify', {
          p_user: issue.author_id,
          p_kind: 'status',
          p_title: fund ? 'Your report is open for funding' : 'Your report was closed',
          p_body: fund ? `${a.title} — goal ${CUR} ${goal}.` : a.reasons[0] ?? 'Not an infrastructure issue.',
          p_link: `/issue/${issueId}`,
        })
      }
      return reply(a)
    }

    if (kind === 'issue') return reply(await screenIssue(input))

    if (kind === 'bid') {
      let payload = input
      // deno-lint-ignore no-explicit-any
      let bid: any = null
      if (bidId) {
        ;({ data: bid } = await admin.from('bids').select('*, issues(*), profiles!bids_contractor_id_fkey(*)').eq('id', bidId).single())
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
      if (bidId) {
        await admin.from('bids').update({ ai: a }).eq('id', bidId)
        // Confident accept from Gemma → award the job without the desk (verified contractors, first good bid wins).
        const canAward =
          a.verdict === 'accept' &&
          a.confidence >= AUTO_ACCEPT &&
          bid.profiles?.verified === true &&
          bid.issues?.assigned_bid_id == null &&
          bid.issues?.status === 'open_for_funding'
        if (canAward) {
          const { error: awardErr } = await admin.rpc('auto_award_bid', {
            p_bid: bidId,
            p_note: `Awarded automatically by Gemma (score ${a.score}, ${Math.round(a.confidence * 100)}% confidence).`,
          })
          if (awardErr) console.error('auto award failed', awardErr)
          else return reply({ ...a, autoAwarded: true })
        }
      }
      return reply(a)
    }

    if (kind === 'cost') {
      const r = await gemma(COST_SYSTEM, JSON.stringify(input))
      return reply({ verdict: verdict(r.verdict), confidence: clamp(r.confidence, 0, 1), reasons: reasons(r.reasons), model: MODEL, source: 'gemma', at: new Date().toISOString() })
    }

    return reply({ error: 'Unknown kind' }, 400)
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e)
    console.error('[ai-screen]', msg)
    return reply({ error: msg }, 500)
  }
})
