import type {
  AdminIssuePatch,
  AppNotification,
  Bid,
  BidAssessment,
  BidStatus,
  CityStats,
  Comment,
  Donation,
  FeedQuery,
  Issue,
  NewIssueInput,
  PhotoRef,
  Profile,
  StatusEvent,
  Story,
} from '../types'

/**
 * Single data contract the UI talks to, implemented by SupabaseApi
 * (real tables / RLS / storage — supabase/migrations/).
 */
export interface Api {
  setViewer(id: string | null): void

  // people
  listProfiles(): Promise<Profile[]>
  getProfile(id: string): Promise<Profile | null>
  contractorJobsDone(id: string): Promise<number>

  // issues & feed
  listIssues(q: FeedQuery): Promise<Issue[]>
  getIssue(id: string): Promise<Issue | null>
  createIssue(input: NewIssueInput): Promise<Issue>
  uploadPhoto(dataUrl: string, folder: 'reports' | 'after'): Promise<PhotoRef>
  vote(issueId: string, value: -1 | 0 | 1): Promise<Issue>
  listEvents(issueId: string): Promise<StatusEvent[]>
  stats(): Promise<CityStats>

  // conversation
  listComments(issueId: string): Promise<Comment[]>
  addComment(issueId: string, body: string): Promise<Comment>
  shareInternal(issueId: string, toUserId: string, note: string): Promise<void>

  // money
  donate(issueId: string, amount: number, opts: { anonymous: boolean; method: string }): Promise<Donation>
  listDonations(f: { issueId?: string; userId?: string }): Promise<Donation[]>

  // admin
  listQueue(): Promise<Issue[]>
  updateIssue(id: string, patch: AdminIssuePatch): Promise<Issue>
  resolveIssue(
    issueId: string,
    input: { afterPhotos: PhotoRef[]; summary: string; finalCost: number },
  ): Promise<Story>

  // contractors
  listBids(f: { issueId?: string; contractorId?: string; status?: BidStatus }): Promise<Bid[]>
  submitBid(
    issueId: string,
    input: { amount: number; days: number; message: string; ai: BidAssessment | null },
  ): Promise<Bid>
  withdrawBid(bidId: string): Promise<Bid>
  decideBid(bidId: string, approve: boolean, note: string): Promise<Bid>
  startWork(issueId: string, note: string): Promise<Issue>

  // stories
  listStories(): Promise<Story[]>
  getStory(id: string): Promise<Story | null>

  // notifications
  listNotifications(): Promise<AppNotification[]>
  markNotificationsRead(): Promise<void>
}
