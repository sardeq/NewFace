import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './index'
import type { AdminIssuePatch, BidStatus, FeedQuery, Issue, NewIssueInput, Profile } from '../types'

export const keys = {
  issues: (q?: FeedQuery) => ['issues', q ?? {}] as const,
  issue: (id: string) => ['issue', id] as const,
  queue: ['queue'] as const,
  events: (id: string) => ['events', id] as const,
  comments: (id: string) => ['comments', id] as const,
  donations: (f: object) => ['donations', f] as const,
  bids: (f: object) => ['bids', f] as const,
  stories: ['stories'] as const,
  story: (id: string) => ['story', id] as const,
  profiles: ['profiles'] as const,
  notifications: ['notifications'] as const,
  stats: ['stats'] as const,
}

/** Everything that can change after a write — cheap to refetch in this app's scale. */
function useInvalidateAll() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries()
}

// ───────── reads ─────────
export const useIssues = (q: FeedQuery) => useQuery({ queryKey: keys.issues(q), queryFn: () => api.listIssues(q) })
export const useIssue = (id: string | undefined) =>
  useQuery({ queryKey: keys.issue(id ?? ''), queryFn: () => api.getIssue(id!), enabled: Boolean(id) })
export const useQueue = (enabled = true) => useQuery({ queryKey: keys.queue, queryFn: () => api.listQueue(), enabled })
export const useEvents = (id: string) => useQuery({ queryKey: keys.events(id), queryFn: () => api.listEvents(id) })
export const useComments = (id: string) => useQuery({ queryKey: keys.comments(id), queryFn: () => api.listComments(id) })
export const useDonations = (f: { issueId?: string; userId?: string }) =>
  useQuery({ queryKey: keys.donations(f), queryFn: () => api.listDonations(f) })
export const useBids = (f: { issueId?: string; contractorId?: string; status?: BidStatus }, enabled = true) =>
  useQuery({ queryKey: keys.bids(f), queryFn: () => api.listBids(f), enabled })
export const useStories = () => useQuery({ queryKey: keys.stories, queryFn: () => api.listStories() })
export const useStory = (id: string | undefined) =>
  useQuery({ queryKey: keys.story(id ?? ''), queryFn: () => api.getStory(id!), enabled: Boolean(id) })
export const useStats = () => useQuery({ queryKey: keys.stats, queryFn: () => api.stats() })
export const useNotifications = (enabled: boolean) =>
  useQuery({ queryKey: keys.notifications, queryFn: () => api.listNotifications(), enabled, refetchInterval: 20000 })

export function useProfiles() {
  const q = useQuery({ queryKey: keys.profiles, queryFn: () => api.listProfiles(), staleTime: 60_000 })
  const byId = new Map<string, Profile>((q.data ?? []).map((p) => [p.id, p]))
  return { ...q, byId }
}

// ───────── writes ─────────
export function useVote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, value }: { id: string; value: -1 | 0 | 1 }) => api.vote(id, value),
    // Optimistic update across every cached list + detail.
    onMutate: async ({ id, value }) => {
      const patch = (i: Issue): Issue => {
        if (i.id !== id) return i
        const prev = i.myVote ?? 0
        return {
          ...i,
          myVote: value,
          upvotes: i.upvotes - (prev === 1 ? 1 : 0) + (value === 1 ? 1 : 0),
          downvotes: i.downvotes - (prev === -1 ? 1 : 0) + (value === -1 ? 1 : 0),
        }
      }
      qc.setQueriesData<Issue[]>({ queryKey: ['issues'] }, (old) => old?.map(patch))
      qc.setQueryData<Issue | null>(keys.issue(id), (old) => (old ? patch(old) : old))
    },
    onSettled: (_d, _e, v) => {
      qc.invalidateQueries({ queryKey: keys.issue(v.id) })
      qc.invalidateQueries({ queryKey: ['issues'] })
    },
  })
}

export function useCreateIssue() {
  const inv = useInvalidateAll()
  return useMutation({ mutationFn: (input: NewIssueInput) => api.createIssue(input), onSuccess: inv })
}

export function useAddComment(issueId: string) {
  const inv = useInvalidateAll()
  return useMutation({ mutationFn: (body: string) => api.addComment(issueId, body), onSuccess: inv })
}

export function useDonate() {
  const inv = useInvalidateAll()
  return useMutation({
    mutationFn: (v: { issueId: string; amount: number; anonymous: boolean; method: string }) =>
      api.donate(v.issueId, v.amount, { anonymous: v.anonymous, method: v.method }),
    onSuccess: inv,
  })
}

export function useShare() {
  return useMutation({
    mutationFn: (v: { issueId: string; to: string; note: string }) => api.shareInternal(v.issueId, v.to, v.note),
  })
}

export function useUpdateIssue() {
  const inv = useInvalidateAll()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: AdminIssuePatch }) => api.updateIssue(id, patch),
    onSuccess: inv,
  })
}

export function useResolveIssue() {
  const inv = useInvalidateAll()
  return useMutation({
    mutationFn: (v: { issueId: string; afterPhotos: string[]; summary: string; finalCost: number }) =>
      api.resolveIssue(v.issueId, v),
    onSuccess: inv,
  })
}

export function useSubmitBid() {
  const inv = useInvalidateAll()
  return useMutation({
    mutationFn: (v: Parameters<typeof api.submitBid>[1] & { issueId: string }) => api.submitBid(v.issueId, v),
    onSuccess: inv,
  })
}

export function useDecideBid() {
  const inv = useInvalidateAll()
  return useMutation({
    mutationFn: (v: { bidId: string; approve: boolean; note: string }) => api.decideBid(v.bidId, v.approve, v.note),
    onSuccess: inv,
  })
}

export function useWithdrawBid() {
  const inv = useInvalidateAll()
  return useMutation({ mutationFn: (bidId: string) => api.withdrawBid(bidId), onSuccess: inv })
}

export function useStartWork() {
  const inv = useInvalidateAll()
  return useMutation({
    mutationFn: (v: { issueId: string; note: string }) => api.startWork(v.issueId, v.note),
    onSuccess: inv,
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.markNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications }),
  })
}
