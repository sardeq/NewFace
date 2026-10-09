// Central app configuration. Rename the product in one place.
export const APP = {
  name: 'Mend',
  tagline: 'The civic ledger for broken things',
  city: 'Amman',
  currency: 'JOD',
  // Fallback map centre when GPS is unavailable (Amman, Third Circle)
  defaultCenter: { lat: 31.9539, lng: 35.9106 },
} as const

const env = import.meta.env

export const SUPABASE_URL = (env.VITE_SUPABASE_URL as string | undefined) ?? ''
export const SUPABASE_ANON_KEY = (env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''
export const HAS_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

export const OPENROUTER_KEY = (env.VITE_OPENROUTER_API_KEY as string | undefined) ?? ''
export const OPENROUTER_MODEL =
  (env.VITE_OPENROUTER_MODEL as string | undefined) || 'google/gemma-4-26b-a4b-it'

/**
 * How AI screening is executed:
 *  - edge:      Supabase Edge Function `ai-screen` (key stays server-side) — use in production
 *  - direct:    browser → OpenRouter with VITE_OPENROUTER_API_KEY (dev only, key is exposed)
 *  - heuristic: offline rules so the UI works with no key at all
 *  - auto:      edge if Supabase is configured, else direct if a key exists, else heuristic
 */
export type AiMode = 'edge' | 'direct' | 'heuristic'
const requested = ((env.VITE_AI_MODE as string | undefined) ?? 'auto').toLowerCase()
export const AI_MODE: AiMode =
  requested === 'edge' || requested === 'direct' || requested === 'heuristic'
    ? requested
    : HAS_SUPABASE
      ? 'edge'
      : OPENROUTER_KEY
        ? 'direct'
        : 'heuristic'

/** AI auto-decision thresholds (screen + recommend; admins can always override). */
export const AI_THRESHOLDS = {
  autoAccept: 0.8,
  autoReject: 0.9,
  /** Cost estimate is auto-approved for fundraising if within this factor of the AI range. */
  costTolerance: 0.25,
}
