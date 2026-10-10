// Central app configuration. Rename the product in one place.
export const APP = {
  name: 'Matab',
  /** مطب — Arabic for "speed bump" */
  nameAr: 'مطب',
  tagline: 'Report it. Back it. Get it fixed.',
  city: 'Amman',
  currency: 'JOD',
  // Fallback map centre when GPS is unavailable (Amman, Third Circle)
  defaultCenter: { lat: 31.9539, lng: 35.9106 },
} as const

// Read each variable by name: `import.meta.env` as a whole would inline every VITE_ var into the bundle.
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''

/**
 * Display label only. Screening runs in the Supabase Edge Function `ai-screen`, which reads
 * OPENROUTER_API_KEY / OPENROUTER_MODEL from Supabase secrets — the key never reaches the browser.
 */
export const OPENROUTER_MODEL =
  (import.meta.env.VITE_OPENROUTER_MODEL as string | undefined) || 'google/gemma-4-26b-a4b-it:free'

/**
 * AI auto-decision thresholds (admins can always override).
 * At or above `autoAccept`, Gemma's "accept" is final: reports are verified AND opened for funding at
 * Gemma's cost estimate, and verified contractors' bids are awarded. Below it, a human decides.
 * Keep in sync with AUTO_ACCEPT / AUTO_REJECT in supabase/functions/ai-screen/index.ts.
 */
export const AI_THRESHOLDS = {
  autoAccept: 0.7,
  autoReject: 0.9,
  /** Cost estimate is auto-approved for fundraising if within this factor of the AI range. */
  costTolerance: 0.25,
}
