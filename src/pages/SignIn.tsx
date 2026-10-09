import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Icon, Logo } from '../components/Icon'
import { Button, Field, Segmented, toast } from '../components/ui'
import { useSession } from '../session/SessionContext'
import { APP } from '../config'
import type { Role } from '../types'

const PERSONAS: Array<{ role: Role; who: string; blurb: string }> = [
  { role: 'citizen', who: 'Lina Haddad', blurb: 'Report damage, vote, comment and chip in.' },
  { role: 'admin', who: 'Hala Qasem · Municipal desk', blurb: 'Triage reports, set costs, approve contractors, publish fixes.' },
  { role: 'contractor', who: 'Karim · Nabulsi Paving Co.', blurb: 'Bid on repair jobs and receive work authorisations.' },
]

export default function SignIn() {
  const { isMock, switchRole, signInWithPassword, signUp } = useSession()
  const nav = useNavigate()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<'citizen' | 'contractor'>('citizen')
  const [company, setCompany] = useState('')
  const [busy, setBusy] = useState(false)

  const go = async () => {
    setBusy(true)
    try {
      if (mode === 'in') await signInWithPassword(email, password)
      else {
        await signUp({ email, password, name, accountType: type, company: type === 'contractor' ? company : undefined })
        toast('Check your inbox to confirm your email')
      }
      nav('/')
    } catch (e) {
      toast((e as Error).message, 'err')
    } finally {
      setBusy(false)
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

        {isMock ? (
          <>
            <p className="muted">
              Running on demo data. Pick who you want to be — you can switch any time from your avatar.
            </p>
            <ul className="persona-list">
              {PERSONAS.map((p) => (
                <li key={p.role}>
                  <button
                    className="persona-pick"
                    onClick={async () => {
                      await switchRole(p.role)
                      nav(p.role === 'admin' ? '/admin' : p.role === 'contractor' ? '/contractor' : '/')
                    }}
                  >
                    <Icon name={p.role === 'admin' ? 'shield' : p.role === 'contractor' ? 'hardhat' : 'user'} size={22} />
                    <span>
                      <strong>{p.who}</strong>
                      <span className="muted">{p.blurb}</span>
                    </span>
                    <Icon name="arrowRight" size={18} />
                  </button>
                </li>
              ))}
            </ul>
            <p className="small muted">
              Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env</code> to switch to real accounts.
            </p>
          </>
        ) : (
          <>
            <Segmented
              label="Sign in or create an account"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'in', label: 'Sign in' },
                { value: 'up', label: 'Create account' },
              ]}
            />
            <div className="form-stack">
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
              <Button variant="primary" size="lg" loading={busy} onClick={go} className="w-full">
                {mode === 'in' ? 'Sign in' : 'Create account'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
