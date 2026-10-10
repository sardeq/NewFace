import type {
  AppNotification,
  Bid,
  Category,
  Comment,
  Donation,
  Issue,
  IssueAssessment,
  IssueStatus,
  Profile,
  StatusEvent,
  Story,
} from '../../types'
import { LIFECYCLE } from '../../lib/format'

export interface MockDb {
  version: number
  refSeq: number
  profiles: Profile[]
  issues: Issue[]
  comments: Comment[]
  donations: Donation[]
  bids: Bid[]
  events: StatusEvent[]
  stories: Story[]
  notifications: AppNotification[]
  /** issueId → userId → vote */
  votes: Record<string, Record<string, -1 | 1>>
}

export const DB_VERSION = 3

const H = 36e5
const ago = (hours: number) => new Date(Date.now() - hours * H).toISOString()

export const DEMO_PERSONAS = {
  citizen: 'u_lina',
  admin: 'u_desk',
  contractor: 'u_nabulsi',
} as const

const profiles: Profile[] = [
  { id: 'u_lina', name: 'Lina Haddad', handle: 'lina.h', role: 'citizen', district: 'Jabal Al-Weibdeh', hue: 18, joinedAt: ago(24 * 140) },
  { id: 'u_omar', name: 'Omar Khalil', handle: 'omar.k', role: 'citizen', district: 'Shmeisani', hue: 200, joinedAt: ago(24 * 90) },
  { id: 'u_rana', name: 'Rana Saleh', handle: 'rana.s', role: 'citizen', district: 'Khalda', hue: 320, joinedAt: ago(24 * 60) },
  { id: 'u_yazan', name: 'Yazan Masri', handle: 'yazan', role: 'citizen', district: 'Jubeiha', hue: 140, joinedAt: ago(24 * 33) },
  { id: 'u_noor', name: 'Noor Abbadi', handle: 'noor.a', role: 'citizen', district: 'Downtown', hue: 45, joinedAt: ago(24 * 12) },
  { id: 'u_desk', name: 'Hala Qasem', handle: 'city.desk', role: 'admin', district: 'Municipal Ops', hue: 230, joinedAt: ago(24 * 400) },
  { id: 'u_nabulsi', name: 'Karim Nabulsi', handle: 'nabulsi.paving', role: 'contractor', company: 'Nabulsi Paving Co.', verified: true, district: 'Marka', hue: 28, joinedAt: ago(24 * 300) },
  { id: 'u_sahel', name: 'Dina Sahel', handle: 'sahel.electric', role: 'contractor', company: 'Sahel Electric', verified: true, district: 'Sweifieh', hue: 260, joinedAt: ago(24 * 210) },
  { id: 'u_quick', name: 'Fadi Odat', handle: 'quickfix', role: 'contractor', company: 'QuickFix Handyman', verified: false, district: 'Tla’ Al-Ali', hue: 90, joinedAt: ago(24 * 20) },
]

const aiOk = (
  category: Category,
  severity: number,
  title: string,
  summary: string,
  costRange: [number, number],
  confidence = 0.9,
  reasons: string[] = ['Clear photo of damage to a public asset.', 'Location is a public right-of-way.'],
): IssueAssessment => ({
  verdict: 'accept',
  confidence,
  category,
  severity,
  title,
  summary,
  costRange,
  reasons,
  model: 'google/gemma-4-26b-a4b-it',
  source: 'gemma',
  at: '',
})

interface SeedIssue {
  id: string
  author: string
  hoursAgo: number
  title: string
  description: string
  category: Category
  severity: number
  status: IssueStatus
  lat: number
  lng: number
  address: string
  district: string
  sketch: string
  up: number
  down: number
  cost: number | null
  raised: number
  ai: IssueAssessment
  verifiedBy: 'ai' | 'admin' | null
  rejectionReason?: string
}

const S: SeedIssue[] = [
  {
    id: 'i_rainbow', author: 'u_lina', hoursAgo: 30, status: 'open_for_funding',
    title: 'Deep pothole swallowing tyres on Rainbow Street',
    description: 'Right after the First Circle turn there is a pothole about 40cm wide and deep enough that cars swerve into the opposite lane to avoid it. Two taxis lost hubcaps this morning. It fills with water when it rains so you cannot see it at night.',
    category: 'roads', severity: 4, lat: 31.9512, lng: 35.9225, address: 'Rainbow St, near First Circle', district: 'Jabal Amman',
    sketch: 'pothole', up: 214, down: 6, cost: 650, raised: 412, verifiedBy: 'ai',
    ai: aiOk('roads', 4, 'Deep pothole swallowing tyres on Rainbow Street', 'A deep pothole on a busy lane is forcing cars into oncoming traffic.', [300, 800], 0.94),
  },
  {
    id: 'i_stairs_light', author: 'u_noor', hoursAgo: 96, status: 'assigned',
    title: 'Every lamp on the Kalha stairs is out',
    description: 'The public stairs from Weibdeh down to downtown have had no working lights for two weeks. Students use them after evening classes and it is pitch black halfway down.',
    category: 'lighting', severity: 4, lat: 31.9568, lng: 35.9262, address: 'Kalha Stairs', district: 'Jabal Al-Weibdeh',
    sketch: 'lamp', up: 341, down: 4, cost: 900, raised: 900, verifiedBy: 'ai',
    ai: aiOk('lighting', 4, 'Every lamp on the Kalha stairs is out', 'Public stairway lighting has failed along its whole length.', [500, 1200], 0.92),
  },
  {
    id: 'i_pipe', author: 'u_omar', hoursAgo: 52, status: 'in_progress',
    title: 'Burst main flooding the sidewalk on Abdul Hamid Sharaf',
    description: 'Clean water has been gushing from a crack in the pavement since last night. The sidewalk is a river and the water is wasting while half the city waits for its water day.',
    category: 'water', severity: 5, lat: 31.9702, lng: 35.8996, address: 'Abdul Hamid Sharaf St', district: 'Shmeisani',
    sketch: 'pipe', up: 498, down: 9, cost: 1800, raised: 1800, verifiedBy: 'ai',
    ai: aiOk('water', 5, 'Burst main flooding the sidewalk on Abdul Hamid Sharaf', 'A broken water main is flooding a pedestrian sidewalk.', [900, 2500], 0.97),
  },
  {
    id: 'i_school_walk', author: 'u_rana', hoursAgo: 20, status: 'open_for_funding',
    title: 'Lifted sidewalk slabs outside a primary school',
    description: 'Tree roots have pushed up six slabs on the school side of the road. Kids trip every morning and parents walk in the street instead. Photo taken at drop-off.',
    category: 'sidewalks', severity: 4, lat: 31.9901, lng: 35.8652, address: 'Wasfi Al-Tal St, school gate', district: 'Tla’ Al-Ali',
    sketch: 'slabs', up: 187, down: 3, cost: 2400, raised: 760, verifiedBy: 'ai',
    ai: aiOk('sidewalks', 4, 'Lifted sidewalk slabs outside a primary school', 'Raised slabs at a school entrance are a trip hazard for children.', [1500, 3200], 0.91),
  },
  {
    id: 'i_stop_sign', author: 'u_rana', hoursAgo: 24 * 16, status: 'resolved',
    title: 'Stop sign knocked flat at a blind junction',
    description: 'Someone hit the stop sign at the Khalda junction and it is lying in the bushes. Drivers coming downhill do not stop anymore.',
    category: 'signage', severity: 5, lat: 31.9928, lng: 35.8451, address: 'Al-Ameer Hashem St junction', district: 'Khalda',
    sketch: 'sign', up: 266, down: 2, cost: 320, raised: 320, verifiedBy: 'ai',
    ai: aiOk('signage', 5, 'Stop sign knocked flat at a blind junction', 'A missing stop sign at a blind junction is a serious collision risk.', [150, 450], 0.95),
  },
  {
    id: 'i_drain', author: 'u_noor', hoursAgo: 5, status: 'pending_review',
    title: 'Storm drain packed with rubble near the Roman Theatre',
    description: 'The drain grate on the corner by the theatre steps is completely filled with rubble and plastic. Last rain the whole corner flooded and shops had water inside.',
    category: 'drainage', severity: 3, lat: 31.9515, lng: 35.9395, address: 'Hashemite Plaza corner', district: 'Downtown',
    sketch: 'drain', up: 58, down: 1, cost: null, raised: 0, verifiedBy: 'ai',
    ai: aiOk('drainage', 3, 'Storm drain packed with rubble near the Roman Theatre', 'A blocked storm drain is causing street flooding next to shops.', [250, 900], 0.88),
  },
  {
    id: 'i_swing', author: 'u_yazan', hoursAgo: 70, status: 'open_for_funding',
    title: 'Snapped swing chain at Jubeiha neighbourhood park',
    description: 'One of the two swings has a snapped chain hanging at head height. The other one is rusty. This is the only playground within walking distance.',
    category: 'parks', severity: 2, lat: 32.0231, lng: 35.8742, address: 'Jubeiha Park, north gate', district: 'Jubeiha',
    sketch: 'swing', up: 92, down: 5, cost: 380, raised: 95, verifiedBy: 'ai',
    ai: aiOk('parks', 2, 'Snapped swing chain at Jubeiha neighbourhood park', 'A broken swing chain in a public playground is a minor injury risk.', [200, 600], 0.86),
  },
  {
    id: 'i_manhole', author: 'u_omar', hoursAgo: 24 * 27, status: 'resolved',
    title: 'Open manhole with no cover on a Marka side street',
    description: 'The manhole cover is gone completely. Someone put a plastic chair in it as a warning. A kid could fall in.',
    category: 'drainage', severity: 5, lat: 31.9751, lng: 35.9852, address: 'Side street off Army St', district: 'Marka',
    sketch: 'drain', up: 402, down: 3, cost: 260, raised: 260, verifiedBy: 'ai',
    ai: aiOk('drainage', 5, 'Open manhole with no cover on a Marka side street', 'An uncovered manhole on a residential street is a fall hazard.', [150, 400], 0.96),
  },
  {
    id: 'i_steps_crack', author: 'u_lina', hoursAgo: 3, status: 'pending_review',
    title: 'Crumbling public steps behind Paris Square',
    description: 'steps broken, need fix',
    category: 'sidewalks', severity: 3, lat: 31.9585, lng: 35.9208, address: 'Behind Paris Square', district: 'Jabal Al-Weibdeh',
    sketch: 'slabs', up: 4, down: 0, cost: null, raised: 0, verifiedBy: null,
    ai: { ...aiOk('sidewalks', 3, 'Crumbling public steps behind Paris Square', 'Public steps appear damaged.', [400, 2000], 0.62, ['Description is very short.', 'Photo is dark; extent of damage unclear.']), verdict: 'review' },
  },
  {
    id: 'i_lamp_abdoun', author: 'u_yazan', hoursAgo: 120, status: 'open_for_funding',
    title: 'Street lamp flickering like a strobe all night',
    description: 'The lamp outside building 14 flickers on and off every second from sunset to sunrise. It is giving residents headaches and the corner is basically dark.',
    category: 'lighting', severity: 2, lat: 31.9432, lng: 35.8801, address: 'Abdoun Circle, bldg 14', district: 'Abdoun',
    sketch: 'lamp', up: 41, down: 7, cost: 220, raised: 180, verifiedBy: 'ai',
    ai: aiOk('lighting', 2, 'Street lamp flickering like a strobe all night', 'A faulty street lamp is flickering through the night.', [120, 400], 0.83),
  },
  {
    id: 'i_abu_nseir', author: 'u_yazan', hoursAgo: 9, status: 'pending_review',
    title: 'Cluster of potholes on the Abu Nseir bus route',
    description: 'Five or six potholes in a row along the bus lane by the roundabout. Buses slam through them and the shaking is cracking the curb as well.',
    category: 'roads', severity: 3, lat: 32.0572, lng: 35.8831, address: 'Abu Nseir roundabout', district: 'Abu Nseir',
    sketch: 'pothole', up: 37, down: 1, cost: null, raised: 0, verifiedBy: 'ai',
    ai: aiOk('roads', 3, 'Cluster of potholes on the Abu Nseir bus route', 'Several potholes along a bus lane are damaging the road edge.', [800, 3000], 0.87),
  },
  {
    id: 'i_hydrant', author: 'u_lina', hoursAgo: 24 * 40, status: 'resolved',
    title: 'Fire hydrant leaking day and night in Sweifieh',
    description: 'The hydrant on the corner has a constant leak from the side valve. There is a permanent puddle and green algae on the pavement.',
    category: 'water', severity: 3, lat: 31.9561, lng: 35.8622, address: 'Wakalat St corner', district: 'Sweifieh',
    sketch: 'pipe', up: 133, down: 2, cost: 450, raised: 450, verifiedBy: 'ai',
    ai: aiOk('water', 3, 'Fire hydrant leaking day and night in Sweifieh', 'A leaking hydrant valve is wasting water continuously.', [250, 700], 0.9),
  },
  {
    id: 'i_spam', author: 'u_noor', hoursAgo: 14, status: 'rejected',
    title: 'Cheap tyres 50% off this week only',
    description: 'Buy now cheap tyres 50% discount call us, follow me for promo',
    category: 'other', severity: 1, lat: 31.96, lng: 35.91, address: '—', district: 'Unknown district',
    sketch: 'pothole', up: 0, down: 3, cost: null, raised: 0, verifiedBy: null,
    rejectionReason: 'Advertisement — not an infrastructure report.',
    ai: { ...aiOk('other', 1, 'Cheap tyres 50% off this week only', 'Promotional text.', [0, 0], 0.97, ['Text is an advertisement.', 'Photo does not show public damage.']), verdict: 'reject' },
  },
]

const COMMENT_POOL: Array<[string, string, string]> = [
  ['i_rainbow', 'u_omar', 'Drove through this at night by accident. Bent my rim. Upvoted.'],
  ['i_rainbow', 'u_yazan', 'There is a second smaller one ten metres further up too.'],
  ['i_rainbow', 'u_desk', 'Verified by our roads team on site. Official estimate attached — 650 JOD covers cut, base layer and hot-mix patch.'],
  ['i_rainbow', 'u_nabulsi', 'We can do this in a single night shift to avoid blocking the street.'],
  ['i_stairs_light', 'u_lina', 'Thank you to everyone who chipped in — fully funded in under 3 days!'],
  ['i_stairs_light', 'u_desk', 'Sahel Electric has been authorised. Work window: next Sunday–Thursday after 6pm.'],
  ['i_pipe', 'u_rana', 'Water company truck just arrived 🙏'],
  ['i_pipe', 'u_nabulsi', 'Crew on site. Main is isolated; excavation started, sidewalk reinstatement tomorrow.'],
  ['i_school_walk', 'u_noor', 'My nephew goes to this school. Donated 20.'],
  ['i_school_walk', 'u_desk', 'Estimate includes root barrier so this does not happen again.'],
  ['i_swing', 'u_lina', 'Taking my kids here on weekends, happy to help.'],
  ['i_drain', 'u_omar', 'Shops on that corner lost stock last winter because of this.'],
  ['i_stop_sign', 'u_desk', 'Replaced with a reflective sign and a new rumble strip. Thanks Rana for reporting.'],
]

function events(issue: SeedIssue): StatusEvent[] {
  const out: StatusEvent[] = []
  const created = issue.hoursAgo
  out.push({ id: `e_${issue.id}_0`, issueId: issue.id, status: 'pending_review', note: 'Report received and screened by Gemma.', actorId: issue.author, at: ago(created) })
  if (issue.status === 'rejected') {
    out.push({ id: `e_${issue.id}_r`, issueId: issue.id, status: 'rejected', note: issue.rejectionReason ?? 'Not actionable.', actorId: 'u_desk', at: ago(created - 0.05) })
    return out
  }
  const target = LIFECYCLE.indexOf(issue.status)
  const notes: Record<string, string> = {
    open_for_funding: 'Cost estimate published. Fundraising open.',
    assigned: 'Repair bid approved. Contractor authorised.',
    in_progress: 'Crew on site.',
    resolved: 'Repair verified by the municipal desk.',
  }
  for (let s = 1; s <= target; s++) {
    const st = LIFECYCLE[s]
    out.push({ id: `e_${issue.id}_${s}`, issueId: issue.id, status: st, note: notes[st], actorId: 'u_desk', at: ago(created * (1 - s / (target + 1.4))) })
  }
  return out
}

function splitDonations(issue: SeedIssue): Donation[] {
  if (!issue.raised) return []
  const donors = ['u_lina', 'u_omar', 'u_rana', 'u_yazan', 'u_noor']
  const chunks: number[] = []
  let left = issue.raised
  let k = 0
  while (left > 0) {
    const piece = Math.min(left, [10, 25, 50, 15, 100, 5, 40, 20][k % 8] * (issue.raised > 1000 ? 4 : 1))
    chunks.push(piece)
    left -= piece
    k++
  }
  return chunks.map((amount, n) => ({
    id: `d_${issue.id}_${n}`,
    issueId: issue.id,
    userId: donors[(n + issue.id.length) % donors.length],
    amount,
    anonymous: n % 5 === 3,
    method: 'card',
    reference: `TX-${issue.id.slice(2, 6).toUpperCase()}-${String(1000 + n * 37).slice(-4)}`,
    createdAt: ago(issue.hoursAgo * (1 - (n + 1) / (chunks.length + 2))),
  }))
}

export function buildSeed(): MockDb {
  let ref = 117
  const issues: Issue[] = S.map((s) => {
    const donations = splitDonations(s)
    return {
      id: s.id,
      ref: ref++,
      authorId: s.author,
      title: s.title,
      description: s.description,
      category: s.category,
      severity: s.severity,
      status: s.status,
      location: { lat: s.lat, lng: s.lng, accuracy: 6 + (ref % 9) },
      address: s.address,
      district: s.district,
      photos: [`sketch:${s.sketch}`],
      createdAt: ago(s.hoursAgo),
      updatedAt: ago(s.hoursAgo / 3),
      upvotes: s.up,
      downvotes: s.down,
      commentCount: COMMENT_POOL.filter((c) => c[0] === s.id).length,
      estimatedCost: s.cost,
      raised: s.raised,
      donorCount: new Set(donations.map((d) => d.userId)).size + Math.floor(donations.length / 3),
      ai: { ...s.ai, at: ago(s.hoursAgo - 0.01) },
      costCheck: s.cost
        ? {
            verdict: 'accept',
            confidence: 0.88,
            reasons: [`Estimate sits within the expected range for this repair.`],
            model: 'google/gemma-4-26b-a4b-it',
            source: 'gemma',
            at: ago(s.hoursAgo * 0.8),
          }
        : null,
      assignedBidId: null,
      storyId: null,
      verifiedBy: s.verifiedBy,
      rejectionReason: s.rejectionReason ?? null,
    }
  })

  const bid = (
    id: string,
    issueId: string,
    contractorId: string,
    amount: number,
    days: number,
    message: string,
    status: Bid['status'],
    hoursAgo: number,
    score: number,
    verdict: 'accept' | 'review' | 'reject',
    reasons: string[],
  ): Bid => ({
    id,
    issueId,
    contractorId,
    amount,
    days,
    message,
    status,
    createdAt: ago(hoursAgo),
    decidedAt: status === 'approved' || status === 'rejected' ? ago(hoursAgo - 4) : null,
    decisionNote: status === 'approved' ? 'Best value, verified crew, fits the work window.' : null,
    authorization: status === 'approved' ? `WA-${id.slice(2).toUpperCase()}-${2600 + hoursAgo}` : null,
    ai: { verdict, confidence: 0.8, score, reasons, model: 'google/gemma-4-26b-a4b-it', source: 'gemma', at: ago(hoursAgo) },
  })

  const bids: Bid[] = [
    bid('b_rb1', 'i_rainbow', 'u_nabulsi', 610, 2, 'Saw-cut the failed area 1.2×1.2m, compact new base course, hot-mix asphalt patch and seal edges. Night work 11pm–5am with cones and a flagman, street reopened by morning.', 'pending', 10, 84, 'accept', ['Price 6% under estimate.', 'Clear method statement with traffic management.', '14 jobs completed on Matab.']),
    bid('b_rb2', 'i_rainbow', 'u_quick', 980, 1, 'We fix fast. Cold patch same day.', 'pending', 6, 41, 'review', ['Price 51% above estimate.', 'Cold patch is a temporary fix on a busy road.', 'Contractor not yet verified.']),
    bid('b_sl1', 'i_stairs_light', 'u_sahel', 870, 5, 'Replace 11 failed LED fixtures and the corroded junction box at the top landing; test circuit and add a photocell timer.', 'approved', 60, 88, 'accept', ['In line with estimate.', 'Electrical specialist, verified.']),
    bid('b_pp1', 'i_pipe', 'u_nabulsi', 1750, 3, 'Emergency excavation, replace 2m of main with ductile iron, backfill and reinstate the sidewalk with matching tiles.', 'approved', 40, 86, 'accept', ['Slightly under estimate.', 'Realistic timeline for severity 5.']),
    bid('b_sw1', 'i_school_walk', 'u_nabulsi', 2300, 6, 'Lift and relay 14m² of slabs, install a root barrier along the tree line, new kerb section at the gate. Work during weekend to avoid school hours.', 'pending', 8, 81, 'accept', ['Price 4% under estimate.', 'Schedules around school hours.']),
    bid('b_sg1', 'i_swing', 'u_quick', 350, 2, 'Replace both swing chains and seats with galvanised chain, sand and repaint frame.', 'pending', 30, 63, 'review', ['Price fits estimate.', 'Contractor not yet verified.']),
    bid('b_ss1', 'i_stop_sign', 'u_sahel', 300, 1, 'Reinstall sign on a new break-away post, add reflective sheeting.', 'approved', 24 * 15, 80, 'accept', ['Within estimate.']),
    bid('b_mh1', 'i_manhole', 'u_nabulsi', 250, 1, 'Supply and fit ductile-iron cover and frame, re-bed with rapid-set mortar.', 'approved', 24 * 26, 90, 'accept', ['Within estimate.', 'Urgent safety job, 1-day turnaround.']),
  ]
  for (const b of bids) if (b.status === 'approved') {
    const i = issues.find((x) => x.id === b.issueId)
    if (i) i.assignedBidId = b.id
  }

  const stories: Story[] = [
    { id: 's_stop_sign', issueId: 'i_stop_sign', afterPhotos: ['sketch:sign:fixed'], summary: 'New reflective stop sign on a break-away post, plus a rumble strip on the downhill approach. Reported, funded and fixed in 9 days.', finalCost: 300, daysToFix: 9, contractorId: 'u_sahel', createdAt: ago(24 * 7) },
    { id: 's_manhole', issueId: 'i_manhole', afterPhotos: ['sketch:drain:fixed'], summary: 'Ductile-iron cover fitted and locked. The plastic chair has been retired with honours.', finalCost: 250, daysToFix: 3, contractorId: 'u_nabulsi', createdAt: ago(24 * 24) },
    { id: 's_hydrant', issueId: 'i_hydrant', afterPhotos: ['sketch:pipe:fixed'], summary: 'Valve gasket replaced by the municipal water crew; the algae patch was pressure-washed.', finalCost: 410, daysToFix: 6, contractorId: null, createdAt: ago(24 * 34) },
  ]
  for (const s of stories) {
    const i = issues.find((x) => x.id === s.issueId)
    if (i) i.storyId = s.id
  }

  const comments: Comment[] = COMMENT_POOL.map(([issueId, authorId, body], n) => {
    const i = S.find((x) => x.id === issueId)!
    return { id: `c_${n}`, issueId, authorId, body, createdAt: ago(i.hoursAgo * (1 - (n % 4 + 1) / 6)) }
  })

  const notifications: AppNotification[] = [
    { id: 'n1', userId: 'u_lina', kind: 'status', title: 'Your report is open for funding', body: 'MT-0117 · Deep pothole on Rainbow Street — official estimate JOD 650.', link: '/issue/i_rainbow', read: false, at: ago(20) },
    { id: 'n2', userId: 'u_lina', kind: 'comment', title: 'Municipal desk replied', body: '“Verified by our roads team on site…”', link: '/issue/i_rainbow', read: false, at: ago(18) },
    { id: 'n3', userId: 'u_lina', kind: 'story', title: 'Fixed: hydrant in Sweifieh', body: 'A report you filed became a success story.', link: '/stories', read: true, at: ago(24 * 34) },
    { id: 'n4', userId: 'u_nabulsi', kind: 'bid_approved', title: 'Work authorised · Burst main, Shmeisani', body: 'Your bid of JOD 1,750 was approved. Authorisation WA-PP1-2640.', link: '/contractor', read: false, at: ago(36) },
    { id: 'n5', userId: 'u_desk', kind: 'status', title: '3 reports waiting for triage', body: 'Gemma auto-verified 2, flagged 1 for review.', link: '/admin', read: false, at: ago(2) },
  ]

  return {
    version: DB_VERSION,
    refSeq: ref,
    profiles,
    issues,
    comments,
    donations: S.flatMap(splitDonations),
    bids,
    events: S.flatMap(events),
    stories,
    notifications,
    votes: { i_rainbow: { u_lina: 1 }, i_pipe: { u_lina: 1 }, i_stairs_light: { u_lina: 1 } },
  }
}
