# Matab (مطب) — report it, back it, get it fixed

*Matab* is Arabic for “speed bump”.

Citizens photograph damaged public infrastructure, the city prices the repair, neighbours
crowdfund it, contractors bid to fix it, and every fix is published as a before/after story.
**Gemma (via OpenRouter)** screens every report, fundraising request and contractor bid.

React 19 · TypeScript · Vite · Supabase · TanStack Query · Leaflet · no UI kit.

## Run it

All data lives in Supabase — set it up first (below), then:

```bash
npm install
npm run dev
```

## Gemma screening (OpenRouter)

| Request | Where | What Gemma decides |
|---|---|---|
| Issue report | Report form step 4, then server-side | accept / reject / review, category, severity, headline, cost range. ≥80% *accept* → published instantly; ≥90% *reject* → closed (appealable); else → human queue |
| Fundraising request | Desk → *Check with Gemma & open funding* | Is the official cost estimate reasonable? Agreement opens the campaign automatically; otherwise reviewer override (logged publicly) |
| Contractor bid | On submit | Score 0–100 + reasons; the desk sees “Gemma’s pick” but a human always approves work |

Every call goes through the Supabase Edge Function `ai-screen`, so the OpenRouter key stays secret.
If the function is unreachable, offline rules screen the request and the result is labelled as such.
Default model: `google/gemma-4-26b-a4b-it` (multimodal, so it also looks at the photo).

## Supabase

1. Create a project, then `supabase link` and `supabase db push` — or paste the files in
   `supabase/migrations/` into the SQL editor in order (`0001_init.sql`: tables, RLS, triggers, RPCs,
   `issue-media` storage bucket, realtime; `0002_fixes.sql`).
2. `supabase secrets set OPENROUTER_API_KEY=sk-or-...` and `supabase functions deploy ai-screen`.
3. Put `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (publishable key) in `.env`.
   In *Authentication → URL Configuration* set the Site URL to where the app runs (e.g. `http://localhost:5173`)
   and add it to Redirect URLs, so email-confirmation links come back to the app. For local development you can
   instead turn off *Confirm email* under *Authentication → Sign In / Providers → Email*.
4. Optional: run `supabase/seed.sql` in the SQL editor for a starter city (Amman — 13 reports, bids,
   donations, success stories, and citizen / admin / contractor accounts; logins are listed at the top of
   the file). Re-running it replaces the previous seed. Then add your photos to `supabase/seed-photos/`
   (names in its README) and run `node scripts/upload-seed-photos.mjs` to upload them to storage.
5. Promote your own admin: `update profiles set role = 'admin' where handle = '...';`
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
  data/supabaseApi.ts  Supabase implementation
  data/hooks.ts        TanStack Query hooks
  components/          ticket card, funding tape, stamps, AI slip, maps, sheets…
  pages/               Feed, Report, IssueDetail, Map, Stories, Profile, Admin, Contractor, SignIn
  style/               tokens → base → layout → components → pages (plain CSS, no framework)
supabase/
  migrations/          schema (0001_init.sql) + fixes (0002_fixes.sql)
  seed.sql             starter data and accounts
  seed-photos/         your images for the seed reports (uploaded by scripts/upload-seed-photos.mjs)
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
