import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { Icon, Logo, type IconName } from './Icon'
import { Avatar, Toaster } from './ui'
import { ActionsProvider } from './Actions'
import { useMarkRead, useNotifications } from '../data/hooks'
import { useSession } from '../session/SessionContext'
import { mockApi } from '../data'
import { APP } from '../config'
import { aiModeLabel } from '../lib/ai'
import { ROLE_LABEL, timeAgo } from '../lib/format'
import type { Role } from '../types'
import { useQueryClient } from '@tanstack/react-query'

interface NavItem {
  to: string
  label: string
  icon: IconName
  roles?: Role[]
  end?: boolean
}

const NAV: NavItem[] = [
  { to: '/', label: 'Ledger', icon: 'feed', end: true },
  { to: '/map', label: 'Map', icon: 'map' },
  { to: '/stories', label: 'Fixed', icon: 'stitch' },
  { to: '/admin', label: 'Desk', icon: 'shield', roles: ['admin'] },
  { to: '/contractor', label: 'Jobs', icon: 'hardhat', roles: ['contractor'] },
  { to: '/me', label: 'You', icon: 'user' },
]

const editionLine = () => {
  const d = new Date()
  const day = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  return `${day} · ${APP.city}`
}

export function AppShell() {
  const { user } = useSession()
  const nav = NAV.filter((n) => !n.roles || (user && n.roles.includes(user.role)))
  const loc = useLocation()
  const pick = (to: string) => nav.find((n) => n.to === to)
  const mobileLeft = [pick('/'), pick('/map')].filter((n): n is NavItem => Boolean(n))
  const mobileRight = [pick('/admin') ?? pick('/contractor') ?? pick('/stories'), pick('/me')].filter(
    (n): n is NavItem => Boolean(n),
  )

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [loc.pathname])

  return (
    <ActionsProvider>
      <div className="shell">
        <Masthead />
        <nav className="rail" aria-label="Main">
          <ul>
            {nav.map((n) => (
              <li key={n.to}>
                <NavLink to={n.to} end={n.end} className="rail-link">
                  <Icon name={n.icon} size={20} />
                  <span>{n.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
          <Link to="/report" className="rail-report">
            <Icon name="plus" size={20} stroke={2.2} />
            <span>Report damage</span>
          </Link>
          <div className="rail-foot mono">
            <div>
              <Icon name="scan" size={13} /> {aiModeLabel()}
            </div>
            <div>{mockApi ? 'Demo data · local' : 'Supabase · live'}</div>
          </div>
        </nav>
        <main className="stage">
          <Outlet />
        </main>
        <nav className="tabbar" aria-label="Main">
          {mobileLeft.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="tab">
              <Icon name={n.icon} size={21} />
              <span>{n.label}</span>
            </NavLink>
          ))}
          <NavLink to="/report" className="tab tab-report" aria-label="Report damage">
            <Icon name="plus" size={24} stroke={2.4} />
          </NavLink>
          {mobileRight.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="tab">
              <Icon name={n.icon} size={21} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
      <Toaster />
    </ActionsProvider>
  )
}

function Masthead() {
  const { user } = useSession()
  return (
    <header className="masthead">
      <Link to="/" className="brand" aria-label={`${APP.name} home`}>
        <Logo size={30} />
        <span className="brand-word">{APP.name}</span>
        <span className="brand-ar" lang="ar" dir="rtl">{APP.nameAr}</span>
      </Link>
      <div className="edition">
        <span>{editionLine()}</span>
      </div>
      <div className="mast-actions">
        <Link to="/report" className="btn btn-primary btn-sm mast-report">
          <Icon name="camera" size={16} />
          <span>Report</span>
        </Link>
        {user && <Bell />}
        <PersonaMenu />
      </div>
    </header>
  )
}

function Bell() {
  const [open, setOpen] = useState(false)
  const { data = [] } = useNotifications(true)
  const markRead = useMarkRead()
  const nav = useNavigate()
  const unread = data.filter((n) => !n.read).length
  const ref = useOutsideClose<HTMLDivElement>(open, () => setOpen(false))
  return (
    <div className="pop-anchor" ref={ref}>
      <button
        className="icon-btn bell"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        onClick={() => {
          setOpen((o) => !o)
          if (!open && unread) setTimeout(() => markRead.mutate(), 1500)
        }}
      >
        <Icon name="bell" size={20} />
        {unread > 0 && <span className="bell-dot num">{unread}</span>}
      </button>
      {open && (
        <div className="pop notif-pop">
          <div className="pop-head">
            <strong>Dispatches</strong>
            <span className="mono muted">{data.length} total</span>
          </div>
          <div className="stitch-rule" />
          {data.length === 0 ? (
            <p className="muted pad">Nothing yet. Report or fund an issue and updates land here.</p>
          ) : (
            <ul className="notif-list">
              {data.slice(0, 12).map((n) => (
                <li key={n.id}>
                  <button
                    className={`notif notif-${n.kind} ${n.read ? '' : 'unread'}`}
                    onClick={() => {
                      setOpen(false)
                      nav(n.link)
                    }}
                  >
                    <span className="notif-glyph">
                      <Icon
                        name={
                          n.kind === 'bid_approved'
                            ? 'hardhat'
                            : n.kind === 'donation'
                              ? 'coin'
                              : n.kind === 'comment'
                                ? 'comment'
                                : n.kind === 'share'
                                  ? 'send'
                                  : n.kind === 'story'
                                    ? 'stitch'
                                    : n.kind === 'bid_rejected'
                                      ? 'x'
                                      : 'flag'
                        }
                        size={15}
                      />
                    </span>
                    <span className="notif-text">
                      <strong>{n.title}</strong>
                      <span>{n.body}</span>
                    </span>
                    <time className="mono muted">{timeAgo(n.at)}</time>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function PersonaMenu() {
  const { user, switchRole, isMock, signOut } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useOutsideClose<HTMLDivElement>(open, () => setOpen(false))
  const nav = useNavigate()
  const qc = useQueryClient()
  if (!user)
    return (
      <Link to="/signin" className="btn btn-line btn-sm">
        Sign in
      </Link>
    )
  return (
    <div className="pop-anchor" ref={ref}>
      <button className="persona-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <Avatar profile={user} size={32} />
      </button>
      {open && (
        <div className="pop persona-pop" role="menu">
          <div className="persona-card">
            <Avatar profile={user} size={40} />
            <div>
              <strong>{user.name}</strong>
              <div className="mono muted">
                {ROLE_LABEL[user.role]}
                {user.company ? ` · ${user.company}` : ''}
              </div>
            </div>
          </div>
          {isMock && (
            <>
              <div className="stitch-rule" />
              <div className="mono caps muted pad-x">View the app as</div>
              <div className="persona-switch">
                {(['citizen', 'admin', 'contractor'] as Role[]).map((r) => (
                  <button
                    key={r}
                    className={user.role === r ? 'on' : ''}
                    onClick={async () => {
                      await switchRole(r)
                      setOpen(false)
                      nav(r === 'admin' ? '/admin' : r === 'contractor' ? '/contractor' : '/')
                    }}
                  >
                    <Icon name={r === 'admin' ? 'shield' : r === 'contractor' ? 'hardhat' : 'user'} size={16} />
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
              <button
                className="menu-item"
                onClick={() => {
                  mockApi?.reset()
                  qc.invalidateQueries()
                  setOpen(false)
                }}
              >
                <Icon name="refresh" size={16} /> Reset demo city
              </button>
            </>
          )}
          {!isMock && (
            <button className="menu-item" onClick={() => signOut()}>
              <Icon name="logout" size={16} /> Sign out
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function useOutsideClose<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])
  return ref
}
