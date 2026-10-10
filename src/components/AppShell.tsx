import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { Icon, Logo, type IconName } from './Icon'
import { Avatar, Skeleton, Toaster } from './ui'
import { LangToggle } from './LangToggle'
import { ActionsProvider } from './Actions'
import { useMarkRead, useNotifications } from '../data/hooks'
import { useSession } from '../session/SessionContext'
import { APP } from '../config'
import { aiModeLabel } from '../lib/ai'
import { roleLabel, timeAgo } from '../lib/format'
import { locale, t, useT } from '../i18n'
import type { Role } from '../types'

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
  const day = d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })
  return `${day} · ${t(APP.city)}`
}

export function AppShell() {
  const t = useT()
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
                  <span>{t(n.label)}</span>
                </NavLink>
              </li>
            ))}
          </ul>
          <Link to="/report" className="rail-report">
            <Icon name="plus" size={20} stroke={2.2} />
            <span>{t('Report damage')}</span>
          </Link>
          <div className="rail-foot mono">
            <div>
              <Icon name="scan" size={13} /> {aiModeLabel()}
            </div>
            <div>
              <span className="live-dot" /> Supabase · {t('live')}
            </div>
          </div>
        </nav>
        <main className="stage">
          {/* Keyed by path: each route mounts fresh and plays the page-enter animation. */}
          <div className="route-line" key={`line-${loc.pathname}`} aria-hidden="true" />
          <div className="page-enter" key={loc.pathname}>
            <Suspense fallback={<Skeleton h={480} />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
        <nav className="tabbar" aria-label="Main">
          {mobileLeft.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="tab">
              <Icon name={n.icon} size={21} />
              <span>{t(n.label)}</span>
            </NavLink>
          ))}
          <NavLink to="/report" className="tab tab-report" aria-label={t('Report damage')}>
            <Icon name="plus" size={24} stroke={2.4} />
          </NavLink>
          {mobileRight.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="tab">
              <Icon name={n.icon} size={21} />
              <span>{t(n.label)}</span>
            </NavLink>
          ))}
        </nav>
      </div>
      <Toaster />
    </ActionsProvider>
  )
}

function Masthead() {
  const t = useT()
  const { user } = useSession()
  return (
    <header className="masthead">
      <Link to="/" className="brand" aria-label={t('{name} home', { name: APP.name })}>
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
          <span>{t('Report')}</span>
        </Link>
        <LangToggle />
        {user && <Bell />}
        <PersonaMenu />
      </div>
    </header>
  )
}

function Bell() {
  const t = useT()
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
        aria-label={unread ? t('Notifications, {n} unread', { n: unread }) : t('Notifications')}
        onClick={() => {
          setOpen((o) => !o)
          if (!open && unread) setTimeout(() => markRead.mutate(), 1500)
        }}
      >
        <Icon name="bell" size={20} />
        {unread > 0 && (
          <span className="bell-dot num" key={unread}>
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="pop notif-pop">
          <div className="pop-head">
            <strong>{t('Dispatches')}</strong>
            <span className="mono muted">{t('{n} total', { n: data.length })}</span>
          </div>
          <div className="stitch-rule" />
          {data.length === 0 ? (
            <p className="muted pad">{t('Nothing yet. Report or fund an issue and updates land here.')}</p>
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
  const t = useT()
  const { user, signOut } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useOutsideClose<HTMLDivElement>(open, () => setOpen(false))
  if (!user)
    return (
      <Link to="/signin" className="btn btn-line btn-sm">
        {t('Sign in')}
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
                {roleLabel(user.role)}
                {user.company ? ` · ${user.company}` : ''}
              </div>
            </div>
          </div>
          <div className="stitch-rule" />
          <button className="menu-item" onClick={() => signOut()}>
            <Icon name="logout" size={16} /> {t('Sign out')}
          </button>
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
