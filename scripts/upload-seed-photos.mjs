// Upload the seed photos in supabase/seed-photos/ to the `issue-media` bucket.
//
//   node scripts/upload-seed-photos.mjs
//
// Run it after supabase/seed.sql. It signs in as the seeded municipal desk account and uploads
// each photo to <desk id>/seed/<name> — the exact URLs seed.sql already stores on the reports.
// Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env. Set SEED_PASSWORD if you changed it.

import { createClient } from '@supabase/supabase-js'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, basename, join } from 'node:path'

const DIR = 'supabase/seed-photos'
const DESK = { id: 'a1000000-0000-4000-8000-000000000006', email: 'desk@matab.test' }
const PASSWORD = process.env.SEED_PASSWORD ?? 'MatabDemo#2026'

// Must match the photo names in supabase/seed.sql.
const NAMES = [
  'rainbow-pothole', 'kalha-stairs-lights', 'burst-main', 'school-sidewalk', 'stop-sign',
  'roman-theatre-drain', 'jubeiha-swing', 'marka-manhole', 'paris-square-steps', 'abdoun-lamp',
  'abu-nseir-potholes', 'sweifieh-hydrant', 'spam-tyres',
  'stop-sign-fixed', 'marka-manhole-fixed', 'sweifieh-hydrant-fixed',
]
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

try {
  process.loadEnvFile('.env')
} catch {
  /* fall back to the shell environment */
}
const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env')

const files = new Map()
for (const f of readdirSync(DIR)) {
  const ext = extname(f).toLowerCase()
  if (!TYPES[ext]) continue
  const name = basename(f, extname(f)).toLowerCase()
  if (!NAMES.includes(name)) console.warn(`?  ${f} — not a seed photo name, skipped`)
  else files.set(name, { path: join(DIR, f), type: TYPES[ext] })
}

const sb = createClient(url, key, { auth: { persistSession: false } })
const { error: authError } = await sb.auth.signInWithPassword({ email: DESK.email, password: PASSWORD })
if (authError) throw new Error(`Could not sign in as ${DESK.email} (did you run seed.sql?): ${authError.message}`)

let uploaded = 0
for (const name of NAMES) {
  const file = files.get(name)
  if (!file) {
    console.warn(`-  ${name} — no file in ${DIR}, the report will show an empty photo tile`)
    continue
  }
  const mb = statSync(file.path).size / 1e6
  const { error } = await sb.storage
    .from('issue-media')
    .upload(`${DESK.id}/seed/${name}`, readFileSync(file.path), { contentType: file.type, cacheControl: '86400' })
  if (!error) {
    uploaded++
    console.log(`✓  ${name}${mb > 2 ? `  (${mb.toFixed(1)} MB — consider resizing to ~1600px)` : ''}`)
  } else if (/exists|duplicate/i.test(error.message)) {
    console.log(`=  ${name} — already uploaded (delete it in Storage → issue-media to replace it)`)
  } else {
    console.error(`✗  ${name} — ${error.message}`)
  }
}
await sb.auth.signOut()
console.log(`\n${uploaded} uploaded.`)
