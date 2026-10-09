export type Role = 'citizen' | 'admin' | 'contractor'

export type IssueStatus =
  | 'pending_review'
  | 'open_for_funding'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'rejected'

export type Category =
  | 'roads'
  | 'lighting'
  | 'water'
  | 'sidewalks'
  | 'signage'
  | 'drainage'
  | 'parks'
  | 'other'

export interface Profile {
  id: string
  name: string
  handle: string
  role: Role
  district: string
  /** Hue used for the generated avatar monogram. */
  hue: number
  /** Contractor-only */
  company?: string
  verified?: boolean
  joinedAt: string
}

export interface GeoPoint {
  lat: number
  lng: number
  accuracy?: number
}

export type AiVerdict = 'accept' | 'reject' | 'review'
export type AiSource = 'gemma' | 'heuristic'

export interface IssueAssessment {
  verdict: AiVerdict
  confidence: number
  category: Category
  severity: number // 1..5
  title: string
  summary: string
  costRange: [number, number]
  reasons: string[]
  model: string
  source: AiSource
  at: string
}

export interface BidAssessment {
  verdict: AiVerdict
  confidence: number
  score: number // 0..100
  reasons: string[]
  model: string
  source: AiSource
  at: string
}

export interface CostAssessment {
  verdict: AiVerdict
  confidence: number
  reasons: string[]
  model: string
  source: AiSource
  at: string
}

/** A photo reference: a URL / data URL, or a built-in field sketch `sketch:<kind>`. */
export type PhotoRef = string

export interface Issue {
  id: string
  ref: number
  authorId: string
  title: string
  description: string
  category: Category
  severity: number
  status: IssueStatus
  location: GeoPoint
  address: string
  district: string
  photos: PhotoRef[]
  createdAt: string
  updatedAt: string
  upvotes: number
  downvotes: number
  commentCount: number
  estimatedCost: number | null
  raised: number
  donorCount: number
  ai: IssueAssessment | null
  costCheck: CostAssessment | null
  assignedBidId: string | null
  storyId: string | null
  rejectionReason?: string | null
  /** Visible on the public feed once verified by Gemma (auto-accept) or an admin. */
  verifiedBy: 'ai' | 'admin' | null
  /** Viewer-relative */
  myVote?: -1 | 0 | 1
}

export interface Comment {
  id: string
  issueId: string
  authorId: string
  body: string
  createdAt: string
}

export interface Donation {
  id: string
  issueId: string
  userId: string
  amount: number
  anonymous: boolean
  method: string
  reference: string
  createdAt: string
}

export type BidStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn'

export interface Bid {
  id: string
  issueId: string
  contractorId: string
  amount: number
  days: number
  message: string
  status: BidStatus
  createdAt: string
  decidedAt: string | null
  decisionNote: string | null
  authorization: string | null
  ai: BidAssessment | null
}

export interface StatusEvent {
  id: string
  issueId: string
  status: IssueStatus
  note: string
  actorId: string
  at: string
}

export type NotificationKind =
  | 'bid_approved'
  | 'bid_rejected'
  | 'status'
  | 'comment'
  | 'share'
  | 'donation'
  | 'story'

export interface AppNotification {
  id: string
  userId: string
  kind: NotificationKind
  title: string
  body: string
  link: string
  read: boolean
  at: string
}

export interface Story {
  id: string
  issueId: string
  afterPhotos: PhotoRef[]
  summary: string
  finalCost: number
  daysToFix: number
  contractorId: string | null
  createdAt: string
}

export type FeedSort = 'hot' | 'new' | 'top' | 'near' | 'funding'

export interface FeedQuery {
  sort: FeedSort
  status?: IssueStatus | 'all' | 'active'
  category?: Category | 'all'
  near?: GeoPoint | null
  authorId?: string
}

export interface NewIssueInput {
  description: string
  photos: PhotoRef[]
  location: GeoPoint
  address: string
  district: string
  ai: IssueAssessment
}

export interface AdminIssuePatch {
  category?: Category
  severity?: number
  title?: string
  estimatedCost?: number | null
  status?: IssueStatus
  note?: string
  costCheck?: CostAssessment | null
  rejectionReason?: string | null
  verifiedBy?: 'ai' | 'admin' | null
}

export interface CityStats {
  reported: number
  resolved: number
  raised: number
  openForFunding: number
  avgDaysToFix: number
}
