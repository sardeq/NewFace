# Seed photos

Put images for the seed reports in this folder (`.jpg`, `.jpeg`, `.png` or `.webp`), then — after running
`supabase/seed.sql` — upload them:

```bash
node scripts/upload-seed-photos.mjs
```

A file is used for a report when either

- it's named after the report's photo name below (`burst-main.jpg`; `Burst Main.JPG` and `burst_main.png` also match), or
- it's listed in the `RENAME` map at the top of `scripts/upload-seed-photos.mjs` (that's how `pot1.jpg`, `b1.jpg`, … are matched).

Editing this table does **not** change anything — it's documentation only.

Landscape shots around 1600px wide work best (cards crop to 16:10).

**Replacing photos that are already uploaded:** change the files, run `supabase/migrations/0003_media_replace.sql`
once, then `node scripts/upload-seed-photos.mjs --replace` and hard-refresh the app.

| Photo name | Your file | Shown on |
|---|---|---|
| `khalda-road` | `pot1.jpg` | **Before** — asphalt broken up along the kerb lane (Khalda, resolved) |
| `khalda-road-fixed` | `pot2.jpg` | **After** — lane resurfaced |
| `marka-pothole` | `b1.jpg` | **Before** — pothole in the middle of a side street (Marka, resolved) |
| `marka-pothole-fixed` | `b2.jpg` | **After** — pothole patched |
| `sweifieh-pothole` | `c1.jpg` | **Before** — pothole full of reflector pieces (Sweifieh, resolved) |
| `sweifieh-pothole-fixed` | `c2.jpg` | **After** — pothole filled |
| `rainbow-pothole` | — | Deep pothole on Rainbow Street |
| `kalha-stairs-lights` | — | Unlit public stairs (Kalha stairs) |
| `burst-main` | — | Burst water main flooding a sidewalk |
| `school-sidewalk` | — | Lifted sidewalk slabs outside a school |
| `roman-theatre-drain` | — | Storm drain packed with rubble |
| `jubeiha-swing` | — | Snapped swing chain in a park |
| `paris-square-steps` | — | Crumbling public steps |
| `abdoun-lamp` | — | Flickering street lamp |
| `abu-nseir-potholes` | — | Cluster of potholes on a bus route |
| `spam-tyres` | — | The rejected spam post (any tyre / ad photo) |
