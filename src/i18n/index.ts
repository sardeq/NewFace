/**
 * Tiny i18n layer — English is the source language, Arabic is a dictionary keyed by the English text.
 *
 *   const t = useT()          // in components (subscribes, so the component re-renders on switch)
 *   t('Report damage')        // → 'أبلغ عن ضرر' in Arabic
 *   t('Fund {ref}', { ref })  // {placeholders} are filled in after translating
 *   tn(3, 'day')              // plural-aware: '3 days' / '3 أيام'
 *
 * A missing Arabic entry falls back to the English text, so nothing ever renders blank.
 */
import { useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { AR, AR_PLURALS, EN_PLURALS, type PluralKey } from './ar'

export type Lang = 'en' | 'ar'
type Vars = Record<string, string | number | null | undefined>

const STORAGE_KEY = 'matab.lang'

function initial(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'ar') return saved
  } catch {
    /* storage blocked */
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ar') ? 'ar' : 'en'
}

let lang: Lang = initial()
const subs = new Set<() => void>()

function applyToDocument() {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  el.lang = lang
  el.dir = lang === 'ar' ? 'rtl' : 'ltr'
  document.title = lang === 'ar' ? 'مطب · بلّغ، ادعم، وأصلحها معًا' : 'Matab · report it, back it, get it fixed'
}
applyToDocument()

export const getLang = () => lang
export const isRtl = () => lang === 'ar'

/** BCP-47 locale for Intl — Arabic keeps Latin digits, which is what Jordanian signage and receipts use. */
export const locale = () => (lang === 'ar' ? 'ar-JO-u-nu-latn' : 'en-GB')

export function setLang(next: Lang) {
  if (next === lang) return
  lang = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* storage blocked — the choice just won't persist */
  }
  applyToDocument()
  subs.forEach((f) => f())
}

const subscribe = (f: () => void) => {
  subs.add(f)
  return () => subs.delete(f)
}

/** Current language; re-renders the caller when it changes. */
export const useLang = () => useSyncExternalStore(subscribe, getLang, getLang)

const fill = (s: string, vars?: Vars) =>
  vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] === undefined || vars[k] === null ? '' : String(vars[k]))) : s

/** Translate a UI string. Safe to call outside React (toasts, formatters). */
export function t(key: string, vars?: Vars): string {
  return fill(lang === 'ar' ? (AR[key] ?? key) : key, vars)
}

const enRules = new Intl.PluralRules('en')
const arRules = new Intl.PluralRules('ar')

/** Plural-aware count: tn(2, 'day') → "2 days" / "يومان". */
export function tn(n: number, key: PluralKey): string {
  if (lang === 'ar') {
    const forms = AR_PLURALS[key]
    const cat = arRules.select(n) as keyof typeof forms
    return fill(forms[cat] ?? forms.other, { n })
  }
  const forms = EN_PLURALS[key]
  return fill(enRules.select(n) === 'one' ? forms.one : forms.other, { n })
}

/** Hook form: subscribes the component to language changes and hands back the translators. */
export function useT() {
  useLang()
  return t
}

/**
 * Switch language with a circular "ink spill" reveal that grows from the button that was clicked.
 * Uses the View Transitions API where available; elsewhere a short cross-fade.
 */
export function switchLang(next: Lang, from?: { x: number; y: number }) {
  if (next === lang) return
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> }
  }
  const root = document.documentElement

  if (reduce) return setLang(next)

  if (!doc.startViewTransition) {
    root.classList.add('lang-fading')
    setTimeout(() => {
      setLang(next)
      root.classList.remove('lang-fading')
      root.classList.add('lang-arriving')
      setTimeout(() => root.classList.remove('lang-arriving'), 450)
    }, 160)
    return
  }

  const x = from?.x ?? innerWidth / 2
  const y = from?.y ?? 0
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  root.classList.add('lang-switching')
  const vt = doc.startViewTransition(() => flushSync(() => setLang(next)))
  vt.ready
    .then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' },
      )
    })
    .catch(() => {})
  vt.finished.finally(() => root.classList.remove('lang-switching'))
}
