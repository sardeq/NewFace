# Matab (مطب) — report it, back it, get it fixed

*Matab* is Arabic for “speed bump”.

Citizens photograph damaged public infrastructure, the city prices the repair, neighbours
crowdfund it, contractors bid to fix it, and every fix is published as a before/after story.
**Gemma (via OpenRouter)** screens every report, fundraising request and contractor bid.

React 19 · TypeScript · Vite · Supabase · TanStack Query · Leaflet · no UI kit.

## Run it

```bash
npm install
npm run dev
```

With no `.env.local` the app runs on a **seeded demo city** (Amman, 13 reports, bids, donations,
success stories) stored in `localStorage`. Use the avatar menu → *View the app as* to switch between
**Citizen**, **Municipal desk** (admin) and **Contractor**; *Reset demo city* restores the seed.

## Gemma screening (OpenRouter)

| Request | Where | What Gemma decides |
|---|---|---|
| Issue report | Report form step 4, then server-side | accept / reject / review, category, severity, headline, cost range. ≥80% *accept* → published instantly; ≥90% *reject* → closed (appealable); else → human queue |
| Fundraising request | Desk → *Check with Gemma & open funding* | Is the official cost estimate reasonable? Agreement opens the campaign automatically; otherwise reviewer override (logged publicly) |
| Contractor bid | On submit | Score 0–100 + reasons; the desk sees “Gemma’s pick” but a human always approves work |

Modes (`VITE_AI_MODE`): `edge` (Supabase Edge Function, key stays secret — use in production),
`direct` (browser → OpenRouter, dev only), `heuristic` (offline rules, no key). `auto` picks for you.
Default model: `google/gemma-4-26b-a4b-it` (multimodal, so it also looks at the photo).

## Supabase

1. Create a project, then `supabase link` and `supabase db push` (runs `supabase/migrations/0001_init.sql`:
   tables, RLS, triggers, RPCs, `issue-media` storage bucket, realtime).
2. `supabase secrets set OPENROUTER_API_KEY=sk-or-...` and `supabase functions deploy ai-screen`.
3. Put `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in `.env.local` — the app switches from demo data
   to real accounts automatically.
4. Promote your first admin: `update profiles set role = 'admin' where handle = '...';`
   Contractors sign up with the *Contractor / business* option and are verified by an admin
   (`verified = true`).

Security notes: new reports are forced to `pending_review` by a trigger — only the edge function
(service role) or an admin can verify them; donations go through the `donate()` RPC (swap for a
payment-provider webhook before real money); users can’t change their own role.

## Structure

```
src/
  config.ts            app name, city, currency, AI thresholds
  types.ts             domain model
  lib/ai.ts            Gemma prompts, OpenRouter/edge calls, fallback rules, auto-decision logic
  data/api.ts          the one data contract the UI uses
  data/mock/           seeded demo city + in-browser implementation
  data/supabaseApi.ts  Supabase implementation
  data/hooks.ts        TanStack Query hooks
  components/          ticket card, funding tape, stamps, AI slip, maps, sheets, sketches…
  pages/               Feed, Report, IssueDetail, Map, Stories, Profile, Admin, Contractor, SignIn
  style/               tokens → base → layout → components → pages (plain CSS, no framework)
supabase/
  migrations/0001_init.sql
  functions/ai-screen/  Deno edge function
```

## Design language

“Road paint”: a pale sky-blue page, deep navy ink, speed-bump yellow for the main actions, with teal,
raspberry and green as status colours. Layout is plain cards and simple tabs — the newspaper feel comes from
the headline serif, not from decoration.
Fonts: Source Serif 4 (headlines), Public Sans (everything else — the US government’s civic typeface).

## Next

- Mobile version (the web app is already responsive with a bottom tab bar)
- Real payment provider + webhook into `donations`
- Push notifications for work authorisations
