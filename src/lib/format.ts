import { APP } from '../config'
import type { Category, IssueStatus, Role } from '../types'

export const STATUS_META: Record<
  IssueStatus,
  { label: string; short: string; tone: string; step: number }
> = {
  pending_review: { label: 'Pending review', short: 'Review', tone: 'ink', step: 0 },
  open_for_funding: { label: 'Open for funding', short: 'Funding', tone: 'signal', step: 1 },
  assigned: { label: 'Assigned', short: 'Assigned', tone: 'sky', step: 2 },
  in_progress: { label: 'In progress', short: 'Working', tone: 'ochre', step: 3 },
  resolved: { label: 'Resolved', short: 'Fixed', tone: 'moss', step: 4 },
  rejected: { label: 'Not actionable', short: 'Closed', tone: 'mute', step: -1 },
}

export const LIFECYCLE: IssueStatus[] = [
  'pending_review',
  'open_for_funding',
  'assigned',
  'in_progress',
  'resolved',
]

export const CATEGORY_META: Record<Category, { label: string; code: string }> = {
  roads: { label: 'Roads & potholes', code: 'RD' },
  lighting: { label: 'Street lighting', code: 'LT' },
  water: { label: 'Water & pipes', code: 'WT' },
  sidewalks: { label: 'Sidewalks & stairs', code: 'SW' },
  signage: { label: 'Signs & signals', code: 'SG' },
  drainage: { label: 'Drainage & flooding', code: 'DR' },
  parks: { label: 'Parks & playgrounds', code: 'PK' },
  other: { label: 'Other', code: 'OT' },
}

export const CATEGORIES = Object.keys(CATEGORY_META) as Category[]

export const ROLE_LABEL: Record<Role, string> = {
  citizen: 'Citizen',
  admin: 'Municipal desk',
  contractor: 'Contractor',
}

export const ticketRef = (ref: number) => `MN-${String(ref).padStart(4, '0')}`

const money = new Intl.NumberFormat('en-JO', { maximumFractionDigits: 0 })
export const fmtMoney = (n: number, withCurrency = true) =>
  withCurrency ? `${APP.currency} ${money.format(Math.round(n))}` : money.format(Math.round(n))

export const fmtCompact = (n: number) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n)

export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(1, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.round(h / 24)
  if (d < 30) return `${d}d`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

export const fmtCoord = (lat: number, lng: number) =>
  `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lng).toFixed(4)}°${lng >= 0 ? 'E' : 'W'}`

export const pct = (part: number, whole: number | null) =>
  whole && whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export const fmtDistance = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`)

export const uid = (prefix = '') =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

export const txnRef = () =>
  `TX-${Date.now().toString(36).toUpperCase().slice(-5)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

/** Reddit-style hot score with urgency weighting. */
export function hotScore(i: { upvotes: number; downvotes: number; severity: number; createdAt: string }) {
  const score = i.upvotes - i.downvotes
  const order = Math.log10(Math.max(Math.abs(score), 1))
  const sign = score > 0 ? 1 : score < 0 ? -1 : 0
  const hours = (Date.now() - new Date(i.createdAt).getTime()) / 36e5
  return sign * order + i.severity * 0.35 - hours / 30
}
