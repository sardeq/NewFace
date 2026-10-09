import { Link, useNavigate } from 'react-router'
import { Icon } from './Icon'
import { Avatar, FundingTape, Photo, Stamp, Urgency } from './ui'
import { useProfiles, useVote } from '../data/hooks'
import { useSession } from '../session/SessionContext'
import { CATEGORY_META, distanceKm, fmtCompact, fmtCoord, fmtDistance, ticketRef, timeAgo } from '../lib/format'
import type { GeoPoint, Issue } from '../types'
import { toast } from './ui'

export function VoteRail({ issue, vertical = true }: { issue: Issue; vertical?: boolean }) {
  const { user } = useSession()
  const vote = useVote()
  const score = issue.upvotes - issue.downvotes
  const cast = (v: -1 | 1) => {
    if (!user) {
      toast("Sign in to vote", "err")
      return
    }
    vote.mutate({ id: issue.id, value: issue.myVote === v ? 0 : v })
  }
  return (
    <div className={`vote ${vertical ? 'is-vertical' : ''}`} aria-label="Urgency votes">
      <button
        className={`vote-btn up ${issue.myVote === 1 ? 'on' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          cast(1)
        }}
        aria-pressed={issue.myVote === 1}
        aria-label="Upvote — this is urgent"
      >
        <Icon name="up" size={18} />
      </button>
      <span className="vote-score num" title={`${issue.upvotes} up · ${issue.downvotes} down`}>
        {fmtCompact(score)}
      </span>
      <button
        className={`vote-btn down ${issue.myVote === -1 ? 'on' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          cast(-1)
        }}
        aria-pressed={issue.myVote === -1}
        aria-label="Downvote — not urgent"
      >
        <Icon name="down" size={18} />
      </button>
    </div>
  )
}

export function IssueCard({
  issue,
  near,
  onShare,
  onDonate,
}: {
  issue: Issue
  near?: GeoPoint | null
  onShare: (i: Issue) => void
  onDonate: (i: Issue) => void
}) {
  const { byId } = useProfiles()
  const nav = useNavigate()
  const author = byId.get(issue.authorId)
  const canFund = issue.status === 'open_for_funding'
  const href = `/issue/${issue.id}`

  return (
    <article className="ticket" onClick={() => nav(href)}>
      <div className="ticket-stub">
        <VoteRail issue={issue} />
      </div>
      <div className="ticket-body">
        <header className="ticket-meta mono">
          <span className="ticket-ref">{ticketRef(issue.ref)}</span>
          <span className="sep">/</span>
          <span className="caps">{CATEGORY_META[issue.category].code}</span>
          <span className="sep">/</span>
          <span className="ticket-where">{issue.district}</span>
          {near && <span className="ticket-dist">· {fmtDistance(distanceKm(near, issue.location))}</span>}
          <span className="ticket-time">{timeAgo(issue.createdAt)}</span>
        </header>

        <div className="ticket-title-row">
          <h3 className="ticket-title">
            <Link to={href} onClick={(e) => e.stopPropagation()}>
              {issue.title}
            </Link>
          </h3>
          <Stamp status={issue.status} />
        </div>

        <p className="ticket-desc">{issue.description}</p>

        <figure className="snap">
          <Photo src={issue.photos[0]} alt={issue.title} className="snap-img" />
          <figcaption className="snap-cap mono">
            <Icon name="pin" size={12} /> {fmtCoord(issue.location.lat, issue.location.lng)}
            {issue.photos.length > 1 && <span className="snap-count">+{issue.photos.length - 1}</span>}
          </figcaption>
          {issue.verifiedBy === 'ai' && (
            <span className="snap-badge mono" title="Auto-verified by Gemma">
              <Icon name="scan" size={12} /> AI-verified
            </span>
          )}
        </figure>

        {(issue.estimatedCost !== null || canFund) && (
          <FundingTape raised={issue.raised} goal={issue.estimatedCost} compact />
        )}

        <footer className="ticket-actions" onClick={(e) => e.stopPropagation()}>
          <span className="ticket-author">
            <Avatar profile={author} size={22} />
            <span>{author?.name ?? 'Citizen'}</span>
          </span>
          <Urgency level={issue.severity} label={false} />
          <span className="spacer" />
          <Link to={`${href}#comments`} className="act">
            <Icon name="comment" size={16} />
            <span className="num">{issue.commentCount}</span>
          </Link>
          <button className="act" onClick={() => onShare(issue)}>
            <Icon name="share" size={16} />
            <span>Share</span>
          </button>
          {canFund && (
            <button className="act act-fund" onClick={() => onDonate(issue)}>
              <Icon name="coin" size={16} />
              <span>Chip in</span>
            </button>
          )}
          {issue.storyId && (
            <Link to={`/stories/${issue.storyId}`} className="act act-story">
              <Icon name="stitch" size={16} />
              <span>Story</span>
            </Link>
          )}
        </footer>
      </div>
    </article>
  )
}
