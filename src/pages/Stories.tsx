import { Link, useParams } from 'react-router'
import { BeforeAfter } from '../components/BeforeAfter'
import { Icon } from '../components/Icon'
import { useActions } from '../components/Actions'
import { Avatar, Button, Empty, Skeleton } from '../components/ui'
import { useDonations, useIssue, useIssues, useProfiles, useStories, useStory } from '../data/hooks'
import { fmtDate, fmtMoney, ticketRef } from '../lib/format'
import type { Issue, Story } from '../types'

export default function Stories() {
  const { data: stories, isLoading } = useStories()
  const { data: issues = [] } = useIssues({ sort: 'new', status: 'resolved' })
  const byIssue = new Map(issues.map((i) => [i.id, i]))
  return (
    <div className="stories-page">
      <header className="page-head">
        <h1>Fixed</h1>
        <p className="page-sub">Reported by neighbours, paid for together. Drag a photo to compare before and after.</p>
      </header>
      {isLoading && <Skeleton h={400} />}
      {stories?.length === 0 && <Empty title="No success stories yet">The first fix will land here.</Empty>}
      <div className="story-grid">
        {stories?.map((s) => (
          <StoryCard key={s.id} story={s} issue={byIssue.get(s.issueId)} />
        ))}
      </div>
    </div>
  )
}

function StoryCard({ story, issue }: { story: Story; issue?: Issue }) {
  const { byId } = useProfiles()
  const c = story.contractorId ? byId.get(story.contractorId) : null
  return (
    <article className="story-card">
      <BeforeAfter before={issue?.photos[0]} after={story.afterPhotos[0]} label={issue?.title ?? 'Repair'} />
      <div className="story-body">
        <div className="mono caps muted">
          {issue ? ticketRef(issue.ref) : ''} · {issue?.district} · {fmtDate(story.createdAt)}
        </div>
        <h3>
          <Link to={`/stories/${story.id}`}>{issue?.title}</Link>
        </h3>
        <p>{story.summary}</p>
        <dl className="story-stats">
          <div>
            <dt className="mono caps">Days</dt>
            <dd className="num">{story.daysToFix}</dd>
          </div>
          <div>
            <dt className="mono caps">Cost</dt>
            <dd className="num">{fmtMoney(story.finalCost)}</dd>
          </div>
          <div>
            <dt className="mono caps">Fixed by</dt>
            <dd>{c?.company ?? 'City crew'}</dd>
          </div>
        </dl>
      </div>
    </article>
  )
}

export function StoryDetail() {
  const { id } = useParams()
  const { data: story, isLoading } = useStory(id)
  const { data: issue } = useIssue(story?.issueId)
  const { data: donations = [] } = useDonations({ issueId: story?.issueId ?? '-' })
  const { byId } = useProfiles()
  const actions = useActions()
  if (isLoading) return <Skeleton h={500} />
  if (!story) return <Empty title="Story not found" />
  const c = story.contractorId ? byId.get(story.contractorId) : null
  const reporter = issue ? byId.get(issue.authorId) : null
  const donors = new Set(donations.map((d) => d.userId)).size
  return (
    <article className="story-detail">
      <Link to="/stories" className="back-link mono caps">
        <Icon name="left" size={14} /> All stories
      </Link>
      <div className="kicker mono caps">Success story · re: {issue ? ticketRef(issue.ref) : ''}</div>
      <h1>{issue?.title}</h1>
      <BeforeAfter before={issue?.photos[0]} after={story.afterPhotos[0]} label={issue?.title ?? ''} />
      <div className="story-detail-grid">
        <div>
          <p className="lede">{story.summary}</p>
          <div className="credits">
            <div>
              <Avatar profile={reporter} size={30} />
              <span>
                <span className="mono caps muted">Reported by</span>
                <strong>{reporter?.name}</strong>
              </span>
            </div>
            <div>
              <Avatar profile={c} size={30} />
              <span>
                <span className="mono caps muted">Repaired by</span>
                <strong>{c?.company ?? 'Municipal crew'}</strong>
              </span>
            </div>
          </div>
          <div className="row-gap">
            {issue && (
              <Link to={`/issue/${issue.id}`} className="btn btn-line">
                <Icon name="receipt" size={17} />
                <span>Original report</span>
              </Link>
            )}
            {issue && (
              <Button variant="ghost" icon="share" onClick={() => actions.share(issue)}>
                Share this story
              </Button>
            )}
          </div>
        </div>
        <dl className="ledger-card story-ledger">
          <div><dt>Days from report to fix</dt><dd className="num">{story.daysToFix}</dd></div>
          <div><dt>Final cost</dt><dd className="num">{fmtMoney(story.finalCost)}</dd></div>
          <div><dt>Original estimate</dt><dd className="num">{issue?.estimatedCost ? fmtMoney(issue.estimatedCost) : '—'}</dd></div>
          <div><dt>Neighbours who funded</dt><dd className="num">{donors}</dd></div>
          <div><dt>Upvotes</dt><dd className="num">{issue ? issue.upvotes : '—'}</dd></div>
        </dl>
      </div>
    </article>
  )
}
