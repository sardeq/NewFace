import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { isAuthError } from '@supabase/supabase-js'
import { Logo } from '../components/Icon'
import { Button, Field, Segmented, toast } from '../components/ui'
import { useSession } from '../session/SessionContext'
import { APP } from '../config'

type Mode = 'in' | 'up'
type FieldName = 'name' | 'company' | 'email' | 'password' | 'confirm'
type Errors = Partial<Record<FieldName, string>>

interface Values {
  name: string
  company: string
  email: string
  password: string
  confirm: string
  type: 'citizen' | 'contractor'
}

// Practical email check: something@something.tld, no spaces. The server has the final say.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const NAME_RE = /^[\p{L}\p{M}' .-]+$/u // letters in any script (Arabic too), spaces, ' . -
const PW_MIN = 8

/** Returns the error for one field, or '' when it's valid. */
function check(field: FieldName, v: Values, mode: Mode): string {
  const email = v.email.trim()
  switch (field) {
    case 'name': {
      if (mode === 'in') return ''
      const n = v.name.trim()
      if (!n) return 'Enter your full name.'
      if (n.length < 2) return 'Name is too short.'
      if (n.length > 60) return 'Keep your name under 60 characters.'
      if (!NAME_RE.test(n)) return 'Use letters, spaces, apostrophes or hyphens only.'
      return ''
    }
    case 'company': {
      if (mode === 'in' || v.type !== 'contractor') return ''
      const c = v.company.trim()
      if (!c) return 'Enter your company name.'
      if (c.length < 2) return 'Company name is too short.'
      if (c.length > 80) return 'Keep the company name under 80 characters.'
      return ''
    }
    case 'email':
      if (!email) return 'Enter your email address.'
      if (email.length > 254 || !EMAIL_RE.test(email)) return 'That doesn’t look like a valid email (e.g. name@example.com).'
      return ''
    case 'password':
      if (!v.password) return 'Enter your password.'
      if (mode === 'in') return ''
      if (v.password.length < PW_MIN) return `Use at least ${PW_MIN} characters.`
      if (v.password.length > 72) return 'Keep it under 72 characters.'
      if (!/[A-Za-z]/.test(v.password) || !/\d/.test(v.password)) return 'Include at least one letter and one number.'
      if (/^\s|\s$/.test(v.password)) return 'Password can’t start or end with a space.'
      return ''
    case 'confirm':
      if (mode === 'in') return ''
      if (!v.confirm) return 'Re-enter your password.'
      if (v.confirm !== v.password) return 'Passwords don’t match.'
      return ''
  }
}

const ORDER: FieldName[] = ['name', 'company', 'email', 'password', 'confirm']

function validateAll(v: Values, mode: Mode): Errors {
  const out: Errors = {}
  for (const f of ORDER) {
    const msg = check(f, v, mode)
    if (msg) out[f] = msg
  }
  return out
}

/** Password strength for the sign-up meter: 0–4. */
function strength(pw: string): number {
  if (!pw) return 0
  let s = 0
  if (pw.length >= PW_MIN) s++
  if (pw.length >= 12) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++
  return s
}
const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong']

/** Supabase Auth / network errors → what the person should do about it. */
function authMessage(e: unknown): string {
  const msg = (e as Error)?.message ?? String(e)
  if (/failed to fetch|networkerror|load failed/i.test(msg))
    return 'Can’t reach the server. Check your connection, and that VITE_SUPABASE_URL in .env is correct.'
  if (/database error saving new user/i.test(msg))
    return 'The account couldn’t be saved (database trigger failed). Make sure both migrations have been run.'
  if (!isAuthError(e)) return msg
  switch (e.code) {
    case 'invalid_credentials':
      return 'Wrong email or password.'
    case 'email_not_confirmed':
      return 'Confirm your email first — use the link we sent you (check spam), or resend it below.'
    case 'user_already_exists':
    case 'email_exists':
      return 'An account with this email already exists — sign in instead.'
    case 'weak_password':
      return e.message || 'Password is too weak.'
    case 'email_address_invalid':
      return 'That email address was rejected. Use a real, deliverable address.'
    case 'over_email_send_rate_limit':
      return 'Too many emails sent for now — Supabase’s built-in mailer allows only a few per hour. Try again later.'
    case 'over_request_rate_limit':
      return 'Too many attempts. Wait a minute and try again.'
    case 'signup_disabled':
    case 'email_provider_disabled':
      return 'Email sign-ups are turned off for this project (Authentication → Sign In / Providers → Email).'
    default:
      return e.message
  }
}

export default function SignIn() {
  const { user, signInWithPassword, signUp, resendConfirmation } = useSession()
  const nav = useNavigate()
  const [mode, setMode] = useState<Mode>('in')
  const [v, setV] = useState<Values>({ name: '', company: '', email: '', password: '', confirm: '', type: 'citizen' })
  const [errors, setErrors] = useState<Errors>({})
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({})
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [unconfirmed, setUnconfirmed] = useState(false)

  // Already signed in (e.g. came back via the confirmation link) → go to the feed.
  useEffect(() => {
    if (user) nav('/', { replace: true })
  }, [user, nav])

  const set = <K extends keyof Values>(k: K, val: Values[K]) => {
    const next = { ...v, [k]: val }
    setV(next)
    setError('')
    // Re-check fields the person has already left, so errors clear as they type.
    setErrors((prev) => {
      const out = { ...prev }
      for (const f of ORDER) if (touched[f] || prev[f]) out[f] = check(f, next, mode) || undefined
      return out
    })
  }

  const blur = (f: FieldName) => {
    setTouched((t) => ({ ...t, [f]: true }))
    // Don't nag about an empty field the moment you tab past it; that waits for submit.
    const raw = f === 'confirm' ? v.confirm : f === 'password' ? v.password : v[f].trim()
    if (!raw) return
    setErrors((prev) => ({ ...prev, [f]: check(f, v, mode) || undefined }))
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setErrors({})
    setTouched({})
    setError('')
    setUnconfirmed(false)
    setV((p) => ({ ...p, password: '', confirm: '' }))
  }

  const go = async (ev: FormEvent) => {
    ev.preventDefault()
    if (busy) return
    setError('')
    setUnconfirmed(false)
    const errs = validateAll(v, mode)
    setErrors(errs)
    setTouched(Object.fromEntries(ORDER.map((f) => [f, true])))
    const first = ORDER.find((f) => errs[f])
    if (first) {
      document.getElementById(`f-${first}`)?.focus()
      return
    }

    const email = v.email.trim().toLowerCase()
    setBusy(true)
    try {
      if (mode === 'in') {
        await signInWithPassword(email, v.password)
        nav('/')
      } else {
        const needsConfirm = await signUp({
          email,
          password: v.password,
          name: v.name.trim().replace(/\s+/g, ' '),
          accountType: v.type,
          company: v.type === 'contractor' ? v.company.trim() : undefined,
        })
        if (needsConfirm) {
          switchMode('in')
          setUnconfirmed(true)
          toast('Account created — confirm your email, then sign in')
        } else nav('/')
      }
    } catch (e) {
      setError(authMessage(e))
      setUnconfirmed(isAuthError(e) && e.code === 'email_not_confirmed')
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    const email = v.email.trim().toLowerCase()
    const msg = check('email', v, mode)
    if (msg) return setErrors((p) => ({ ...p, email: msg }))
    try {
      await resendConfirmation(email)
      toast('Confirmation email sent')
    } catch (e) {
      setError(authMessage(e))
    }
  }

  /** Common props for each validated input. */
  const bind = (f: FieldName) => ({
    id: `f-${f}`,
    className: 'input',
    onBlur: () => blur(f),
    'aria-invalid': errors[f] ? true : undefined,
    'aria-describedby': errors[f] ? `err-${f}` : undefined,
  })

  const pwScore = strength(v.password)

  return (
    <div className="signin">
      <div className="signin-card">
        <div className="signin-brand">
          <Logo size={40} />
          <div>
            <h1>{APP.name}</h1>
            <p className="mono caps muted">{APP.tagline}</p>
          </div>
        </div>
        <div className="stitch-rule" />

        <Segmented
          label="Sign in or create an account"
          value={mode}
          onChange={switchMode}
          options={[
            { value: 'in', label: 'Sign in' },
            { value: 'up', label: 'Create account' },
          ]}
        />
        <form className="form-stack" onSubmit={go} noValidate>
          {mode === 'up' && (
            <>
              <Field label="Full name" error={errors.name} errorId="err-name">
                <input
                  {...bind('name')}
                  value={v.name}
                  onChange={(e) => set('name', e.target.value)}
                  autoComplete="name"
                  maxLength={60}
                />
              </Field>
              <Segmented
                label="Account type"
                value={v.type}
                onChange={(t) => {
                  set('type', t)
                  if (t === 'citizen') setErrors((p) => ({ ...p, company: undefined }))
                }}
                options={[
                  { value: 'citizen', label: 'Resident', icon: 'user' },
                  { value: 'contractor', label: 'Contractor / business', icon: 'hardhat' },
                ]}
              />
              {v.type === 'contractor' && (
                <Field
                  label="Company"
                  hint="The municipal desk verifies contractors before awarding work."
                  error={errors.company}
                  errorId="err-company"
                >
                  <input
                    {...bind('company')}
                    value={v.company}
                    onChange={(e) => set('company', e.target.value)}
                    autoComplete="organization"
                    maxLength={80}
                  />
                </Field>
              )}
            </>
          )}
          <Field label="Email" error={errors.email} errorId="err-email">
            <input
              {...bind('email')}
              type="email"
              inputMode="email"
              value={v.email}
              onChange={(e) => set('email', e.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
            />
          </Field>
          <Field
            label="Password"
            error={errors.password}
            errorId="err-password"
            hint={mode === 'up' ? `At least ${PW_MIN} characters, with a letter and a number.` : undefined}
          >
            <div className="pw-wrap">
              <input
                {...bind('password')}
                type={showPw ? 'text' : 'password'}
                value={v.password}
                onChange={(e) => set('password', e.target.value)}
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                maxLength={72}
              />
              <button
                type="button"
                className="pw-toggle mono caps"
                onClick={(e) => {
                  e.preventDefault()
                  setShowPw((s) => !s)
                }}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </Field>
          {mode === 'up' && v.password && (
            <div className="pw-meter" aria-live="polite">
              <div className="pw-meter-bar">
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} className={i <= pwScore ? `on s${pwScore}` : ''} />
                ))}
              </div>
              <span className="mono caps">{STRENGTH_LABEL[pwScore] || 'Too short'}</span>
            </div>
          )}
          {mode === 'up' && (
            <Field label="Confirm password" error={errors.confirm} errorId="err-confirm">
              <input
                {...bind('confirm')}
                type={showPw ? 'text' : 'password'}
                value={v.confirm}
                onChange={(e) => set('confirm', e.target.value)}
                autoComplete="new-password"
                maxLength={72}
              />
            </Field>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
            {mode === 'in' ? 'Sign in' : 'Create account'}
          </Button>
          {unconfirmed && (
            <Button type="button" onClick={resend} disabled={!v.email.trim()}>
              Resend confirmation email
            </Button>
          )}
        </form>
      </div>
    </div>
  )
}
