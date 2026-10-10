import { useState } from 'react'
import { Link } from 'react-router'
import { Icon } from '../components/Icon'
import { Avatar, Empty, Segmented, Stamp } from '../components/ui'
import { useDonations, useIssues, useNotifications } from '../data/hooks'
import { useSession } from '../session/SessionContext'
import { fmtDate, fmtDateTime, fmtMoney, ROLE_LABEL, ticketRef, timeAgo } from '../lib/format'
import type { Role } from '../types'

type Tab = 'reports' | 'donations' | 'dispatches'

export default function Profile() {
  const { user, isMock, switchRole } = useSession()
  const [tab, setTab] = useState<Tab>('reports')
  const { data: reports = [] } = useIssues({ sort: 'new', status: 'all', authorId: user?.id ?? '-' })
  const { data: donations = [] } = useDonations({ userId: user?.id ?? '-' })
  const { data: notes = [] } = useNotifications(Boolean(user))

  if (!user)
    return (
      <Empty title="You’re not signed in" icon="user">
        <Link to="/signin">Sign in</Link> to see your reports and donations.
      </Empty>
    )

  const given = donations.reduce((s, d) => s + d.amount, 0)
  const backed = new Set(donations.map((d) => d.issueId)).size
  const mended = reports.filter((r) => r.status === 'resolved').length

  return (
    <div className="profile">
      <header className="id-card">
        <Avatar profile={user} size={72} />
        <div className="id-main">
          <div className="mono caps muted">
            {ROLE_LABEL[user.role]} · member since {fmtDate(user.joinedAt)}
          </div>
          <h1>{user.name}</h1>
          <div className="mono">
            @{user.handle} · {user.company ? `${user.company} · ` : ''}
            {user.district}
          </div>
        </div>
        <dl className="id-stats">
          <div><dt className="mono caps">Reports</dt><dd className="num">{reports.length}</dd></div>
          <div><dt className="mono caps">Fixed</dt><dd className="num">{mended}</dd></div>
          <div><dt className="mono caps">Given</dt><dd className="num">{fmtMoney(given)}</dd></div>
          <div><dt className="mono caps">Backed</dt><dd className="num">{backed}</dd></div>
        </dl>
      </header>

      {isMock && (
        <div className="demo-switch">
          <span className="mono caps">Demo · view the app as</span>
          {(['citizen', 'admin', 'contractor'] as Role[]).map((r) => (
            <button key={r} className={`chip ${user.role === r ? 'on' : ''}`} onClick={() => switchRole(r)}>
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      )}

      <Segmented
        label="Profile sections"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'reports', label: 'My reports', count: reports.length },
          { value: 'donations', label: 'Donations', count: donations.length },
          { value: 'dispatches', label: 'Dispatches', count: notes.filter((n) => !n.read).length },
        ]}
      />

      {tab === 'reports' && (
        <ul className="row-list">
          {reports.length === 0 && <Empty title="No reports yet">Spotted something broken? <Link to="/report">Report it</Link>.</Empty>}
          {reports.map((r) => (
            <li key={r.id}>
              <Link to={`/issue/${r.id}`} className="row-item">
                <span className="mono muted">{ticketRef(r.ref)}</span>
                <span className="row-title">
                  {r.title}
                  {!r.verifiedBy && r.status === 'pending_review' && <span className="badge mono caps">awaiting reviewer</span>}
                </span>
                <span className="mono muted">{timeAgo(r.createdAt)}</span>
                <Stamp status={r.status} small />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {tab === 'donations' && (
        <div className="txn-wrap">
          {donations.length === 0 ? (
            <Empty title="No donations yet" icon="coin">Issues open for funding show a “Chip in” button.</Empty>
          ) : (
            <table className="txn">
              <thead>
                <tr>
                  <th className="mono caps">Date</th>
                  <th className="mono caps">Reference</th>
                  <th className="mono caps">Issue</th>
                  <th className="mono caps">Method</th>
                  <th className="mono caps num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {donations.map((d) => (
                  <tr key={d.id}>
                    <td className="mono">{fmtDateTime(d.createdAt)}</td>
                    <td className="mono">{d.reference}</td>
                    <td>
                      <Link to={`/issue/${d.issueId}`}>View issue</Link>
                      {d.anonymous && <span className="badge mono caps">anon</span>}
                    </td>
                    <td className="mono caps">{d.method}</td>
                    <td className="num">{fmtMoney(d.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="mono caps">Total given</td>
                  <td className="num">{fmtMoney(given)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {tab === 'dispatches' && (
        <ul className="row-list">
          {notes.length === 0 && <Empty title="No dispatches" icon="bell" />}
          {notes.map((n) => (
            <li key={n.id}>
              <Link to={n.link} className={`row-item ${n.read ? '' : 'unread'}`}>
                <Icon name={n.kind === 'bid_approved' ? 'hardhat' : n.kind === 'donation' ? 'coin' : 'bell'} size={16} />
                <span className="row-title">
                  <strong>{n.title}</strong>
                  <span className="muted"> — {n.body}</span>
                </span>
                <span className="mono muted">{timeAgo(n.at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
