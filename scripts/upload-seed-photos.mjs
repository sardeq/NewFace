// Upload the seed photos in supabase/seed-photos/ to the `issue-media` bucket.
//
//   node scripts/upload-seed-photos.mjs            # upload photos that aren't in storage yet
//   node scripts/upload-seed-photos.mjs --replace  # overwrite existing ones with your new files
//
// Run it after supabase/seed.sql. It signs in as the seeded municipal desk account and uploads
// each photo to <desk id>/seed/<name> — the exact URLs seed.sql already stores on the reports.
// Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env. Set SEED_PASSWORD if you changed it.
// --replace needs supabase/migrations/0003_media_replace.sql (lets an account overwrite its own files).

import { createClient } from '@supabase/supabase-js'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, basename, join } from 'node:path'

const DIR = 'supabase/seed-photos'
const DESK = { id: 'a1000000-0000-4000-8000-000000000006', email: 'desk@matab.test' }
const PASSWORD = process.env.SEED_PASSWORD ?? 'MatabDemo#2026'

// Must match the photo names in supabase/seed.sql.
const NAMES = [
  'rainbow-pothole', 'kalha-stairs-lights', 'burst-main', 'school-sidewalk', 'khalda-road',
  'roman-theatre-drain', 'jubeiha-swing', 'marka-pothole', 'paris-square-steps', 'abdoun-lamp',
  'abu-nseir-potholes', 'sweifieh-pothole', 'spam-tyres',
  'khalda-road-fixed', 'marka-pothole-fixed', 'sweifieh-pothole-fixed',
]

// Use your own file names: <your file name, without extension> → <seed photo name>.
// Files already named after a seed photo (e.g. burst-main.jpg) don't need an entry.
const RENAME = {
  pot1: 'khalda-road',
  pot2: 'khalda-road-fixed',
  b1: 'marka-pothole',
  b2: 'marka-pothole-fixed',
  c1: 'sweifieh-pothole',
  c2: 'sweifieh-pothole-fixed',
}
const REPLACE = process.argv.includes('--replace')
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
  // "Rainbow Pothole.JPG" / "rainbow_pothole.jpg" → rainbow-pothole
  const own = basename(f, extname(f)).trim().toLowerCase().replace(/[\s_]+/g, '-')
  const name = RENAME[own] ?? own
  if (!NAMES.includes(name)) console.warn(`?  ${f} — not a seed photo name, skipped`)
  else {
    if (files.has(name)) console.warn(`!  ${f} — another file is already used for ${name}, skipped`)
    else files.set(name, { path: join(DIR, f), type: TYPES[ext] })
    if (name !== own) console.log(`   ${f} → ${name}`)
  }
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
    .upload(`${DESK.id}/seed/${name}`, readFileSync(file.path), { contentType: file.type, cacheControl: '3600', upsert: REPLACE })
  if (!error) {
    uploaded++
    console.log(`${REPLACE ? '↻' : '✓'}  ${name}${mb > 2 ? `  (${mb.toFixed(1)} MB — consider resizing to ~1600px)` : ''}`)
  } else if (/exists|duplicate/i.test(error.message)) {
    console.log(`=  ${name} — already uploaded (run with --replace to overwrite it)`)
  } else if (REPLACE && /row-level security|unauthorized|403/i.test(error.message)) {
    console.error(`✗  ${name} — not allowed to overwrite: run supabase/migrations/0003_media_replace.sql first`)
  } else {
    console.error(`✗  ${name} — ${error.message}`)
  }
}
await sb.auth.signOut()
console.log(`\n${uploaded} ${REPLACE ? 'uploaded/replaced' : 'uploaded'}.${REPLACE && uploaded ? ' Hard-refresh the app (Ctrl+Shift+R) if you still see the old photos.' : ''}`)
