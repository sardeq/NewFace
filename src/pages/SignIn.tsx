import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { isAuthError } from '@supabase/supabase-js'
import { Logo } from '../components/Icon'
import { Button, Field, Segmented, toast } from '../components/ui'
import { useSession } from '../session/SessionContext'
import { APP } from '../config'

/** Supabase Auth error codes → what the person should do about it. */
function authMessage(e: unknown): string {
  if (!isAuthError(e)) return (e as Error).message
  switch (e.code) {
    case 'invalid_credentials':
      return 'Wrong email or password.'
    case 'email_not_confirmed':
      return 'Confirm your email first — use the link we sent you (check spam), or resend it below.'
    case 'user_already_exists':
    case 'email_exists':
      return 'An account with this email already exists — sign in instead.'
    case 'weak_password':
      return e.message || 'Password is too weak — use at least 6 characters.'
    case 'email_address_invalid':
      return 'That email address was rejected. Use a real, deliverable address.'
    case 'over_email_send_rate_limit':
      return 'Too many emails sent for now — Supabase’s built-in mailer allows only a few per hour. Try again later.'
    case 'signup_disabled':
      return 'New sign-ups are turned off for this project.'
    default:
      return e.message
  }
}

export default function SignIn() {
  const { signInWithPassword, signUp, resendConfirmation } = useSession()
  const nav = useNavigate()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<'citizen' | 'contractor'>('citizen')
  const [company, setCompany] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [unconfirmed, setUnconfirmed] = useState(false)

  const go = async (ev: FormEvent) => {
    ev.preventDefault()
    setError('')
    setUnconfirmed(false)
    const addr = email.trim()
    if (mode === 'up' && !name.trim()) return setError('Enter your name.')
    if (mode === 'up' && type === 'contractor' && !company.trim()) return setError('Enter your company name.')
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    setBusy(true)
    try {
      if (mode === 'in') {
        await signInWithPassword(addr, password)
        nav('/')
      } else {
        const needsConfirm = await signUp({
          email: addr,
          password,
          name: name.trim(),
          accountType: type,
          company: type === 'contractor' ? company.trim() : undefined,
        })
        if (needsConfirm) {
          setMode('in')
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
    try {
      await resendConfirmation(email.trim())
      toast('Confirmation email sent')
    } catch (e) {
      setError(authMessage(e))
    }
  }

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
          onChange={(m) => {
            setMode(m)
            setError('')
          }}
          options={[
            { value: 'in', label: 'Sign in' },
            { value: 'up', label: 'Create account' },
          ]}
        />
        <form className="form-stack" onSubmit={go} noValidate>
          {mode === 'up' && (
            <>
              <Field label="Full name">
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
              <Segmented
                label="Account type"
                value={type}
                onChange={setType}
                options={[
                  { value: 'citizen', label: 'Resident', icon: 'user' },
                  { value: 'contractor', label: 'Contractor / business', icon: 'hardhat' },
                ]}
              />
              {type === 'contractor' && (
                <Field label="Company" hint="The municipal desk verifies contractors before awarding work.">
                  <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} />
                </Field>
              )}
            </>
          )}
          <Field label="Email">
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="Password">
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            />
          </Field>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
            {mode === 'in' ? 'Sign in' : 'Create account'}
          </Button>
          {unconfirmed && (
            <Button type="button" onClick={resend} disabled={!email.trim()}>
              Resend confirmation email
            </Button>
          )}
        </form>
      </div>
    </div>
  )
}
