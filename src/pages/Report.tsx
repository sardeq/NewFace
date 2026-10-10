import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Icon } from '../components/Icon'
import { AiSlip } from '../components/AiPanel'
import { LocationPicker } from '../components/Maps'
import { Avatar, Button, Photo, Stamp, toast, Urgency } from '../components/ui'
import { useCreateIssue } from '../data/hooks'
import { useSession } from '../session/SessionContext'
import { APP } from '../config'
import { intakeOutcome, screenIssue } from '../lib/ai'
import { getPosition, reverseGeocode, type Place } from '../lib/geo'
import { compressImage } from '../lib/media'
import { CATEGORY_META, fmtCoord, ticketRef } from '../lib/format'
import type { GeoPoint, Issue, IssueAssessment } from '../types'

type Step = 0 | 1 | 2 | 3
const STEPS = ['Evidence', 'Location', 'Description', 'Screen & post'] as const
const MAX_PHOTOS = 4
const HINTS = ['Getting worse', 'Children nearby', 'Dangerous at night', 'Blocks wheelchairs', 'Been like this for weeks']

export default function Report() {
  const { user } = useSession()
  const create = useCreateIssue()
  const [step, setStep] = useState<Step>(0)
  const [photos, setPhotos] = useState<string[]>([])
  const [busyPhotos, setBusyPhotos] = useState(false)
  const [point, setPoint] = useState<GeoPoint | null>(null)
  const [gps, setGps] = useState<'locating' | 'ok' | 'error'>('locating')
  const [gpsMsg, setGpsMsg] = useState('')
  const [place, setPlace] = useState<Place | null>(null)
  const [desc, setDesc] = useState('')
  const [ai, setAi] = useState<IssueAssessment | null>(null)
  const [screening, setScreening] = useState(false)
  const [filed, setFiled] = useState<Issue | null>(null)
  const camRef = useRef<HTMLInputElement>(null)
  const galRef = useRef<HTMLInputElement>(null)

  // 1. GPS is captured automatically the moment the reporter opens the form.
  const acquire = useCallback(
    () =>
      getPosition().then(
        (p) => {
          setPoint(p)
          setGps('ok')
          setGpsMsg('')
        },
        (e: Error) => {
          setGps('error')
          setGpsMsg(e.message)
          setPoint((p) => p ?? { ...APP.defaultCenter })
        },
      ),
    [],
  )
  const locate = () => {
    setGps('locating')
    void acquire()
  }
  useEffect(() => {
    void acquire()
  }, [acquire])

  // Reverse-geocode whenever the pin settles.
  useEffect(() => {
    if (!point) return
    const ctl = new AbortController()
    const t = setTimeout(() => reverseGeocode(point, ctl.signal).then(setPlace), 500)
    return () => {
      clearTimeout(t)
      ctl.abort()
    }
  }, [point])

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusyPhotos(true)
    try {
      const room = MAX_PHOTOS - photos.length
      const next = await Promise.all(Array.from(files).slice(0, room).map((f) => compressImage(f)))
      setPhotos((p) => [...p, ...next])
      setAi(null)
    } catch {
      toast('Could not read that image', 'err')
    } finally {
      setBusyPhotos(false)
    }
  }

  // 4. Gemma screens the report as soon as the reporter reaches the last step.
  const runScreen = async () => {
    setScreening(true)
    try {
      setAi(await screenIssue({ description: desc, photo: photos[0], address: place?.address, district: place?.district }))
    } finally {
      setScreening(false)
    }
  }
  const goTo = (s: Step) => {
    setStep(s)
    if (s === 3 && !ai && !screening) void runScreen()
  }

  const submit = async () => {
    if (!ai || !point) return
    try {
      const issue = await create.mutateAsync({
        description: desc.trim(),
        photos,
        location: point,
        address: place?.address ?? 'Unnamed street',
        district: place?.district ?? 'Unknown district',
        ai,
      })
      setFiled(issue)
    } catch (e) {
      toast((e as Error).message, 'err')
    }
  }

  const canNext = [photos.length > 0, Boolean(point) && gps !== 'locating', desc.trim().length >= 12, Boolean(ai)][step]

  if (!user)
    return (
      <div className="narrow">
        <h1>Sign in to report</h1>
        <p className="muted">Reports are tied to an account so the city can follow up with you.</p>
        <Link to="/signin" className="btn btn-primary">Sign in</Link>
      </div>
    )

  if (filed)
    return (
      <Filed
        issue={filed}
        onAnother={() => {
          setFiled(null)
          setStep(0)
          setPhotos([])
          setDesc('')
          setAi(null)
          void locate()
        }}
      />
    )

  const outcome = ai ? intakeOutcome(ai) : null

  return (
    <div className="report">
      <header className="page-head">
        <h1>Report damage</h1>
        <p className="page-sub">A photo, a pin on the map and a short description. Takes about a minute.</p>
      </header>

      <ol className="steps" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className={i < step ? 'done' : i === step ? 'now' : ''}>
            <button onClick={() => i < step && goTo(i as Step)} disabled={i > step}>
              <span className="step-n mono">{i < step ? <Icon name="check" size={12} stroke={3} /> : `0${i + 1}`}</span>
              <span>{s}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="report-grid">
        <section className="report-panel">
          {step === 0 && (
            <div className="r-step">
              <h2>Show us the damage</h2>
              <p className="muted">A clear photo is the single best way to get a report verified fast. Up to {MAX_PHOTOS}.</p>
              <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => addFiles(e.target.files)} />
              <input ref={galRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
              <div className="capture-row">
                <button className="capture" onClick={() => camRef.current?.click()} disabled={photos.length >= MAX_PHOTOS}>
                  <Icon name="camera" size={30} stroke={1.5} />
                  <strong>Take a photo</strong>
                  <span className="mono muted">opens camera</span>
                </button>
                <button className="capture" onClick={() => galRef.current?.click()} disabled={photos.length >= MAX_PHOTOS}>
                  <Icon name="image" size={30} stroke={1.5} />
                  <strong>From gallery</strong>
                  <span className="mono muted">jpg · png · heic</span>
                </button>
              </div>
              {(photos.length > 0 || busyPhotos) && (
                <ul className="thumbs">
                  {photos.map((p, i) => (
                    <li key={i}>
                      <img src={p} alt={`Photo ${i + 1}`} />
                      <button className="thumb-x" aria-label="Remove photo" onClick={() => setPhotos((xs) => xs.filter((_, j) => j !== i))}>
                        <Icon name="x" size={14} stroke={2.5} />
                      </button>
                      {i === 0 && <span className="thumb-cover mono caps">Cover</span>}
                    </li>
                  ))}
                  {busyPhotos && <li className="thumb-busy mono">processing…</li>}
                </ul>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="r-step">
              <h2>Pin the exact spot</h2>
              <div className={`gps-readout gps-${gps}`}>
                <span className="gps-led" />
                <div>
                  <div className="mono caps">
                    {gps === 'locating' ? 'Acquiring GPS…' : gps === 'ok' ? 'GPS lock' : 'Manual placement'}
                  </div>
                  <div className="gps-coord mono num">
                    {point ? fmtCoord(point.lat, point.lng) : '—'}
                    {point?.accuracy ? <span> · ±{point.accuracy} m</span> : null}
                  </div>
                </div>
                <Button size="sm" variant="line" icon="locate" onClick={locate} loading={gps === 'locating'}>
                  Re-scan
                </Button>
              </div>
              {gpsMsg && <p className="note-err">{gpsMsg}</p>}
              {point && <LocationPicker point={point} onChange={setPoint} />}
              <p className="place-line">
                <Icon name="pin" size={15} />
                {place ? (
                  <>
                    <strong>{place.address}</strong> <span className="muted">· {place.district}</span>
                  </>
                ) : (
                  <span className="muted">Looking up the street name…</span>
                )}
              </p>
              <p className="muted small">Drag the crosshair or tap the map if the dot is off.</p>
            </div>
          )}

          {step === 2 && (
            <div className="r-step">
              <h2>Tell it plainly</h2>
              <p className="muted">What’s damaged, how big, and who it puts at risk. Arabic or English is fine.</p>
              <textarea
                className="input textarea"
                rows={6}
                maxLength={1000}
                autoFocus
                value={desc}
                placeholder="e.g. Pothole about 40cm wide on the right lane after the circle. Cars swerve into oncoming traffic to avoid it."
                onChange={(e) => {
                  setDesc(e.target.value)
                  setAi(null)
                }}
              />
              <div className="desc-meta">
                <div className="chip-row">
                  {HINTS.map((h) => (
                    <button key={h} className="chip" onClick={() => setDesc((d) => `${d.trim()}${d.trim() ? '. ' : ''}${h}.`)}>
                      + {h}
                    </button>
                  ))}
                </div>
                <span className="mono muted num">{desc.length}/1000</span>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="r-step">
              <h2>Screening your report</h2>
              {screening && (
                <div className="scanning">
                  <div className="scan-bar" />
                  <p className="mono">Gemma is reading your photo and description…</p>
                </div>
              )}
              {ai && (
                <>
                  <AiSlip
                    a={ai}
                    outcome={
                      outcome === 'published'
                        ? 'Looks genuine — this will go live immediately and open for funding at Gemma’s cost estimate.'
                        : outcome === 'queued'
                          ? 'Not sure enough to auto-publish — a municipal reviewer will look at it, usually within a day.'
                          : 'This probably isn’t something the city can fix. You can still file it; it will be closed with this reason and you can appeal.'
                    }
                  />
                  <Button variant="ghost" size="sm" icon="refresh" onClick={() => (setAi(null), void runScreen())}>
                    Screen again
                  </Button>
                </>
              )}
            </div>
          )}

          <footer className="r-nav">
            {step > 0 ? (
              <Button variant="ghost" icon="left" onClick={() => goTo((step - 1) as Step)}>
                Back
              </Button>
            ) : (
              <span />
            )}
            {step < 3 ? (
              <Button variant="ink" iconRight="arrowRight" disabled={!canNext} onClick={() => goTo((step + 1) as Step)}>
                Continue
              </Button>
            ) : (
              <Button variant="primary" icon="send" disabled={!ai} loading={create.isPending} onClick={submit}>
                {outcome === 'rejected' ? 'File anyway' : 'Post report'}
              </Button>
            )}
          </footer>
        </section>

        <aside className="report-preview">
          <div className="mono caps muted">Your post, as it will appear</div>
          <PreviewTicket photos={photos} desc={desc} point={point} place={place} ai={ai} />
        </aside>
      </div>
    </div>
  )
}

/** Live preview of the auto-generated public post. */
function PreviewTicket({
  photos,
  desc,
  point,
  place,
  ai,
}: {
  photos: string[]
  desc: string
  point: GeoPoint | null
  place: Place | null
  ai: IssueAssessment | null
}) {
  const { user } = useSession()
  const title = ai?.title ?? (desc.split(/[.!?\n]/)[0]?.trim() || 'Your headline is written from your description')
  return (
    <article className="ticket is-preview">
      <div className="ticket-stub">
        <div className="vote is-vertical">
          <span className="vote-btn on"><Icon name="up" size={18} /></span>
          <span className="vote-score num">1</span>
          <span className="vote-btn"><Icon name="down" size={18} /></span>
        </div>
      </div>
      <div className="ticket-body">
        <header className="ticket-meta mono">
          <span className="ticket-ref">MT-····</span>
          <span className="sep">/</span>
          <span className="caps">{ai ? CATEGORY_META[ai.category].code : '··'}</span>
          <span className="sep">/</span>
          <span className="ticket-where">{place?.district ?? 'locating…'}</span>
          <span className="ticket-time">now</span>
        </header>
        <div className="ticket-title-row">
          <h3 className={`ticket-title ${ai ? '' : 'is-ghost'}`}>{title}</h3>
          <Stamp status="pending_review" />
        </div>
        <p className={`ticket-desc ${desc ? '' : 'is-ghost'}`}>{desc || 'Your description goes here.'}</p>
        <figure className="snap">
          {photos[0] ? (
            <Photo src={photos[0]} alt="Cover" className="snap-img" />
          ) : (
            <div className="snap-img snap-empty">
              <Icon name="camera" size={28} stroke={1.4} />
            </div>
          )}
          <figcaption className="snap-cap mono">
            <Icon name="pin" size={12} /> {point ? fmtCoord(point.lat, point.lng) : '—'}
          </figcaption>
        </figure>
        <footer className="ticket-actions">
          <span className="ticket-author">
            <Avatar profile={user} size={22} />
            <span>{user?.name}</span>
          </span>
          {ai && <Urgency level={ai.severity} label={false} />}
        </footer>
      </div>
    </article>
  )
}

function Filed({ issue, onAnother }: { issue: Issue; onAnother: () => void }) {
  const live = issue.verifiedBy === 'ai'
  const funding = issue.status === 'open_for_funding'
  const rejected = issue.status === 'rejected'
  return (
    <div className="filed">
      <div className={`filed-stamp ${rejected ? 'tone-mute' : live ? 'tone-moss' : 'tone-ochre'}`}>
        {rejected ? 'Closed' : live ? 'Posted' : 'Filed'}
      </div>
      <div className="mono caps muted">{ticketRef(issue.ref)}</div>
      <h1>{issue.title}</h1>
      <p className="muted">
        {rejected
          ? `Gemma closed this report: ${issue.rejectionReason ?? 'not actionable'}. If you think that’s wrong, comment on it to appeal.`
          : live && funding
            ? `Verified automatically and open for funding — goal ${issue.estimatedCost ?? ''} ${APP.currency}. Share it so neighbours can chip in.`
            : live
            ? 'Verified automatically and now live on the public ledger. You’ll get a dispatch when the city attaches a cost and opens funding.'
            : 'Waiting for a municipal reviewer. You’ll get a dispatch as soon as it’s verified.'}
      </p>
      <div className="row-gap">
        <Link to={`/issue/${issue.id}`} className="btn btn-ink">
          <span>View your post</span>
          <Icon name="arrowRight" size={17} />
        </Link>
        <Button variant="line" icon="plus" onClick={onAnother}>
          Report another
        </Button>
      </div>
    </div>
  )
}
