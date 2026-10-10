# Seed photos

Put images for the seed reports in this folder (`.jpg`, `.jpeg`, `.png` or `.webp`), then — after running
`supabase/seed.sql` — upload them:

```bash
node scripts/upload-seed-photos.mjs
```

A file is used for a report when either

- it's listed in **`map.json`** (your file name without extension → photo name), e.g. `"jordan": "rainbow-pothole"`, or
- it's named after the photo name itself (`burst-main.jpg`; `Burst Main.JPG` and `burst_main.png` also match).

To use a new photo: drop it here, add a line to `map.json`, run the upload script. Editing this README changes nothing.

Landscape shots around 1600px wide work best (cards crop to 16:10).

**Replacing a photo that's already uploaded:** run `supabase/migrations/0003_media_replace.sql` once, then
`node scripts/upload-seed-photos.mjs --replace` and hard-refresh the app.

**Reports with no photo of yours:** `node scripts/fetch-seed-photos.mjs` tries to download freely-licensed
photos from Wikimedia Commons for them (credits go in `CREDITS.md`).

| Photo name | Your file | Shown on |
|---|---|---|
| `rainbow-pothole` | `jordan.jpeg` | Deep pothole on Rainbow Street — open for funding |
| `abu-nseir-potholes` | `pothole2.jpeg` | Potholes on the Abu Nseir bus route — auto-funded by Gemma |
| `paris-square-road` | `pothole3.jpeg` | Vague road report behind Paris Square — waiting for a human |
| `abdoun-sign` | `cook3.jpeg` | No-entry sign knocked flat in Abdoun — open for funding |
| `downtown-bins` | `cook.jpeg` | Overflowing bins near the Roman Theatre — waiting for a human |
| `khalda-road` / `khalda-road-fixed` | `pot1.jpg` / `pot2.jpg` | Before / after — Khalda lane resurfaced (resolved) |
| `marka-pothole` / `marka-pothole-fixed` | `b1.jpg` / `b2.jpg` | Before / after — Marka pothole patched (resolved) |
| `sweifieh-pothole` / `sweifieh-pothole-fixed` | `c1.jpg` / `c2.jpg` | Before / after — Sweifieh pothole filled (resolved) |
| `kalha-stairs-lights` | — | Unlit public stairs (Kalha stairs) |
| `burst-main` | — | Burst water main flooding a sidewalk |
| `school-sidewalk` | — | Lifted sidewalk slabs outside a school |
| `jubeiha-swing` | — | Snapped swing chain in a park |
| `spam-tyres` | — | The rejected spam post (any tyre / ad photo) |
