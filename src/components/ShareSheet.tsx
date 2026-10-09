import { useState } from 'react'
import { Avatar, Button, Sheet, toast } from './ui'
import { Icon } from './Icon'
import { useProfiles, useShare } from '../data/hooks'
import { useSession } from '../session/SessionContext'
import { APP } from '../config'
import { ticketRef } from '../lib/format'
import type { Issue } from '../types'

export function ShareSheet({ issue, onClose }: { issue: Issue | null; onClose: () => void }) {
  return (
    <Sheet open={Boolean(issue)} onClose={onClose} kicker={issue ? ticketRef(issue.ref) : ''} title="Pass it on" width={460}>
      {issue && <ShareBody key={issue.id} issue={issue} onClose={onClose} />}
    </Sheet>
  )
}

function ShareBody({ issue, onClose }: { issue: Issue; onClose: () => void }) {
  const { user } = useSession()
  const { data: people = [] } = useProfiles()
  const share = useShare()
  const [q, setQ] = useState('')
  const [to, setTo] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const url = `${location.origin}/issue/${issue.id}`
  const text = `${issue.title} — ${ticketRef(issue.ref)} on ${APP.name}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast('Link copied')
    } catch {
      toast('Could not copy — long-press the link instead', 'err')
    }
  }
  const native = async () => {
    try {
      await navigator.share({ title: APP.name, text, url })
    } catch {
      /* user cancelled */
    }
  }
  const send = async () => {
    if (!to) return
    await share.mutateAsync({ issueId: issue.id, to, note })
    toast('Sent inside the app')
    onClose()
  }

  const matches = people
    .filter((p) => p.id !== user?.id)
    .filter((p) => `${p.name} ${p.handle} ${p.company ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 6)

  return (
    <div className="share">
      <div className="share-link">
        <code className="mono">{url.replace(/^https?:\/\//, '')}</code>
        <Button size="sm" variant="ink" icon="copy" onClick={copy}>
          Copy
        </Button>
      </div>
      <div className="share-ext">
        {'share' in navigator && (
          <button className="share-tile" onClick={native}>
            <Icon name="external" /> Device share
          </button>
        )}
        <a className="share-tile" href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noreferrer">
          <Icon name="comment" /> WhatsApp
        </a>
        <a className="share-tile" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer">
          <Icon name="send" /> Post on X
        </a>
        <a className="share-tile" href={`mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`}>
          <Icon name="link" /> Email
        </a>
      </div>

      <div className="dotted-rule" />

      <div className="share-internal">
        <div className="mono caps muted">Send to someone on {APP.name}</div>
        <input className="input" placeholder="Search neighbours, contractors…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="people">
          {matches.map((p) => (
            <li key={p.id}>
              <button className={`person ${to === p.id ? 'on' : ''}`} onClick={() => setTo(p.id)}>
                <Avatar profile={p} size={28} />
                <span>
                  <strong>{p.company ?? p.name}</strong>
                  <span className="mono muted">@{p.handle}</span>
                </span>
                {to === p.id && <Icon name="check" size={16} />}
              </button>
            </li>
          ))}
        </ul>
        {to && (
          <>
            <input className="input" placeholder="Add a note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button variant="primary" icon="send" loading={share.isPending} onClick={send} className="w-full">
              Send
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
