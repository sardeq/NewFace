// Download real, freely-licensed photos from Wikimedia Commons for the seed reports that have no photo yet.
//
//   node scripts/fetch-seed-photos.mjs          # fill the gaps, then:
//   node scripts/upload-seed-photos.mjs
//
// Saves <name>.jpg into supabase/seed-photos/ and writes the required author / licence credits to
// supabase/seed-photos/CREDITS.md. Reports that already have a photo (your own files, see map.json) are
// skipped. Don't like a pick? Delete that file and run again with a different query below, or with
// --skip to move to the next search result:  node scripts/fetch-seed-photos.mjs --skip
// (add  `--only rainbow-pothole`  to redo just one).

import { existsSync, readdirSync, writeFileSync, readFileSync } from 'node:fs'
import { extname, basename, join } from 'node:path'

const DIR = 'supabase/seed-photos'
const CREDITS = join(DIR, 'CREDITS.md')

// Seed photo name → Wikimedia Commons search. Only reports without a photo of yours are listed;
// edit a query to get a different photo.
const QUERIES = {
  'kalha-stairs-lights': 'public outdoor stairway city night',
  'burst-main': 'burst water main street flooding',
  'school-sidewalk': 'tree roots damaged sidewalk',
  'jubeiha-swing': 'broken swing playground',
  'spam-tyres': 'pile of used tyres',
}

// Reports already covered by your own files (supabase/seed-photos/map.json) are skipped.
const MAPPED = new Set(Object.values(JSON.parse(readFileSync(join(DIR, 'map.json'), 'utf8'))))

const args = process.argv.slice(2)
const skip = args.includes('--skip') ? 1 : 0
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null
const UA = 'MatabSeedFetcher/1.0 (local dev seed script; https://github.com/)'

const have = new Set(
  readdirSync(DIR)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .map((f) => basename(f, extname(f)).toLowerCase().replace(/[\s_]+/g, '-')),
)
MAPPED.forEach((n) => have.add(n))

const strip = (html = '') => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

async function search(query) {
  const u = new URL('https://commons.wikimedia.org/w/api.php')
  Object.entries({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: '30',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '1600',
  }).forEach(([k, v]) => u.searchParams.set(k, v))
  const res = await fetch(u, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`Commons search failed: HTTP ${res.status}`)
  const pages = Object.values((await res.json()).query?.pages ?? {}).sort((a, b) => a.index - b.index)
  return pages
    .map((p) => ({ title: p.title, page: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`, ...(p.imageinfo?.[0] ?? {}) }))
    .filter((i) => i.mime === 'image/jpeg' && i.width >= 1000 && i.width > i.height * 1.15)
    .filter((i) => {
      const lic = i.extmetadata?.LicenseShortName?.value ?? ''
      return /CC|Public domain|PD/i.test(lic) && !/fair use|non-free/i.test(lic)
    })
}

if (!existsSync(CREDITS)) writeFileSync(CREDITS, '# Seed photo credits\n\nPhotos from Wikimedia Commons, used under their stated licences.\n\n')

let saved = 0
for (const [name, query] of Object.entries(QUERIES)) {
  if (only && name !== only) continue
  if (have.has(name)) {
    console.log(`=  ${name} — already has a photo, skipped`)
    continue
  }
  try {
    const hits = await search(query)
    const pick = hits[skip]
    if (!pick) {
      console.warn(`-  ${name} — no suitable photo for "${query}" (try another query)`)
      continue
    }
    const img = await fetch(pick.thumburl ?? pick.url, { headers: { 'User-Agent': UA } })
    if (!img.ok) throw new Error(`download HTTP ${img.status}`)
    writeFileSync(join(DIR, `${name}.jpg`), Buffer.from(await img.arrayBuffer()))
    const m = pick.extmetadata ?? {}
    const line = `- **${name}.jpg** — [${pick.title.replace(/^File:/, '')}](${pick.page}) by ${strip(m.Artist?.value) || 'unknown'}, ${m.LicenseShortName?.value ?? 'see source'}\n`
    const rest = readFileSync(CREDITS, 'utf8').split('\n').filter((l) => !l.includes(`**${name}.jpg**`)).join('\n')
    writeFileSync(CREDITS, rest.replace(/\n*$/, '\n') + line)
    console.log(`✓  ${name}  ←  ${pick.title}`)
    saved++
  } catch (e) {
    console.error(`✗  ${name} — ${e.message}`)
  }
  await new Promise((r) => setTimeout(r, 400)) // be polite to the Commons API
}
console.log(`\n${saved} saved to ${DIR}. Now run: node scripts/upload-seed-photos.mjs`)
